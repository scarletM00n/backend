import {prisma} from "../model/prisma";

export class order_services {
    constructor(){}

    private scheduleAutoPaymentConfirmation(orderId: string) {
        setTimeout(async () => {
            try {
                await this.confirmPaymentForOrderService(orderId, { source: 'auto-simulation' });
            }
            catch (err) {
                console.error('Failed to auto-confirm payment for order:', orderId, err);
            }
        }, 5_000);
    }

    async confirmPaymentForOrderService(
        orderId: string,
        options?: {
            source?: 'auto-simulation' | 'gateway-callback';
            transactionId?: string;
        },
    ) {
        // Extension point: integrate real gateway verification and transaction persistence here.
        const updated = await prisma.$transaction(async (tx) => {
            const updateResult = await tx.order.updateMany({
                where: {
                    id: orderId,
                    status: 'pending',
                },
                data: {
                    status: 'paid',
                },
            });

            if (updateResult.count === 0) {
                return null;
            }

            await tx.deliveryMessage.create({
                data: {
                    order_id: orderId,
                    sender: 'system',
                    message: options?.source === 'gateway-callback'
                        ? 'Payment confirmed. Your order is now being prepared for shipment.'
                        : 'Payment simulated and confirmed. Your order is now being prepared for shipment.',
                },
            });

            return tx.order.findUnique({
                where: {
                    id: orderId,
                },
            });
        });

        return updated;
    }

    async placeOrderService (userId : string , addressId : string , delivery_method : string , payment_method : string){

        const cart = await prisma.cart.findUnique({
            where : {
                user_id : userId
            },
            include : {
                cart_items : {
                    include : {
                        product : {
                            include : {
                                sizes : true
                            }
                        }
                    }
                }
            }
        });
        
        if(!cart || cart.cart_items.length === 0){
            throw new Error("Cart is empty");
        }

        const address = await prisma.address.findUnique({
            where : {
                id : addressId
            }
        });

        if(!address){
            throw new Error("Address not found");
        }

        const subtotal = cart.cart_items.reduce((sum , it) =>{
            const sizeprice = it.product.sizes.find(s => s.size === it.size)?.price ?? 0 ;
            return sum + it.quantity * Number(sizeprice);
        } , 0 );

        const tax = subtotal * 0.08 ; // 8% tax
        const shipping = delivery_method === "express" ? 70 : 0 ;
        const total = subtotal + tax + shipping ;

        const points_earned = Math.floor(subtotal / 10) ; // 1 point per $10 spent

        const placedOrder = await prisma.$transaction(async (tx) => {
            for (const it of cart.cart_items) {
                const sizeStockUpdate = await tx.productSize.updateMany({
                    where: {
                        product_id: it.product_id,
                        size: it.size,
                        stock: {
                            gte: it.quantity,
                        },
                    },
                    data: {
                        stock: {
                            decrement: it.quantity,
                        },
                    },
                });

                if (sizeStockUpdate.count === 0) {
                    throw new Error(`Insufficient stock for ${it.product.name} (${it.size})`);
                }
            }

            const order = await tx.order.create({
                data : {
                    user_id : userId ,
                    address_id : addressId ,
                    delivery_method ,
                    payment_method,
                    total_price : total.toFixed(2) ,
                    order_items : {
                        create : cart.cart_items.map(it => {
                            const sizeprice = it.product.sizes.find(s => s.size === it.size)?.price ?? 0 ;
                            return {
                                product_id : it.product_id ,
                                size : it.size ,
                                quantity : it.quantity ,
                                price : sizeprice.toFixed(2)
                            }
                        })
                    }
                },
                include : { 
                    order_items : {
                        include : {
                            product : {
                                select : {
                                    id : true ,
                                    name : true ,
                                    image_url : true,
                                    brand : {
                                        select : {
                                            name : true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    address : true
                }
            });

            // Create initial delivery message
            await tx.deliveryMessage.create({
                data: {
                    order_id: order.id,
                    sender: 'system',
                    message: 'Your order has been placed! We are preparing your items for delivery.'
                }
            });

            // Clear cart
            await tx.cartItem.deleteMany({
                where : {
                    cart_id : cart.id
                }
            });

            // Update user points
            const updatedUser = await tx.user.update({
                where : {
                    id : userId
                },
                data : {
                    points : {
                        increment : points_earned
                    }
                },
                select : {
                    id : true,
                    points : true
                }
            });

            return {
                order,
                points_earned,
                points: updatedUser.points,
            };
        });

        this.scheduleAutoPaymentConfirmation(placedOrder.order.id);

        return placedOrder;
    }

    async getOrderHistoryService (userId : string){

        const orders = await prisma.order.findMany({
            where : {
                user_id : userId
            },
            orderBy : {
                created_at : "desc"
            },
            include : {
                order_items : {
                    include : {
                        product : {
                            select : {
                                id : true ,
                                name : true ,
                                image_url : true ,
                                brand : {
                                    select : {
                                        name : true
                                    }
                                }
                            }
                        }
                    }
                },
                address : true
            }
        });

        return orders ;
    }

    async getOrderByIdService(userId : string , orderId : string){

        const order = await prisma.order.findFirst({
            where : {
                id : orderId ,
                user_id : userId
            },
            include : {
                order_items : {
                    include : {
                        product : {
                            select : {
                                id : true ,
                                name : true ,
                                image_url : true ,
                                brand : {
                                    select : {
                                        name : true
                                    }
                                }
                            }
                        }
                    }
                },
                address : true
            }
        });

        return order ;
    }

    async getTrackerPayloadService(userId : string , orderId : string){
        const order = await prisma.order.findFirst({
            where : {
                id : orderId ,
                user_id : userId
            },
            include : {
                address : true,
                order_items : {
                    include : {
                        product : {
                            select : {
                                id : true,
                                name : true,
                                image_url : true,
                                brand : {
                                    select : {
                                        name : true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if(!order){
            throw new Error("Order not found");
        }

        const messages = await prisma.deliveryMessage.findMany({
            where : {
                order_id : orderId
            },
            orderBy : {
                created_at : "asc"
            }
        });

        return {
            order,
            messages
        };
    }

    async postDeliveryMessageService(userId : string , orderId : string , message : string){
        // Verify order belongs to user
        const order = await prisma.order.findFirst({
            where : {
                id : orderId,
                user_id : userId
            }
        });

        if(!order){
            throw new Error("Order not found");
        }

        const newMessage = await prisma.deliveryMessage.create({
            data : {
                order_id : orderId,
                sender : 'customer',
                message
            }
        });

        return newMessage;
    }

    async markOrderReceivedService(userId : string , orderId : string){
        const order = await prisma.order.findFirst({
            where : {
                id : orderId,
                user_id : userId
            }
        });

        if(!order){
            throw new Error("Order not found");
        }

        const updatedOrder = await prisma.order.update({
            where : {
                id : orderId
            },
            data : {
                status : 'delivered',
                delivery_person_id : null,
                delivery_latitude : null,
                delivery_longitude : null,
                delivery_location_updated_at : null,
                assigned_at : null
            }
        });

        // Add system message
        await prisma.deliveryMessage.create({
            data : {
                order_id : orderId,
                sender : 'system',
                message : 'Order marked as received. Thank you for your purchase!'
            }
        });

        return updatedOrder;
    }

    async markOrderCancelledService(userId : string , orderId : string){
        const order = await prisma.order.findFirst({
            where : {
                id : orderId,
                user_id : userId
            }
        });

        if(!order){
            throw new Error("Order not found");
        }

        const updatedOrder = await prisma.order.update({
            where : {
                id : orderId
            },
            data : {
                status : 'cancelled'
            }
        });

        // Add system message
        await prisma.deliveryMessage.create({
            data : {
                order_id : orderId,
                sender : 'system',
                message : 'Order has been cancelled.'
            }
        });

        return updatedOrder;
    }

    async getDeliveryAvailableOrdersService(){
        return prisma.order.findMany({
            where : {
                status : {
                    in : ['pending', 'paid', 'shipped']
                },
                delivery_person_id : null
            },
            orderBy : {
                created_at : 'desc'
            },
            include : {
                address : true,
                order_items : {
                    include : {
                        product : {
                            select : {
                                id : true,
                                name : true,
                                image_url : true,
                                brand : {
                                    select : {
                                        name : true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async getDeliveryAssignedOrdersService(userId : string){
        return prisma.order.findMany({
            where : {
                delivery_person_id : userId,
                status : {
                    in : ['pending', 'paid', 'shipped']
                }
            },
            orderBy : {
                updated_at : 'desc'
            },
            include : {
                user : {
                    select : {
                        full_name : true,
                        phone : true
                    }
                },
                address : true,
                order_items : {
                    include : {
                        product : {
                            select : {
                                id : true,
                                name : true,
                                image_url : true,
                                brand : {
                                    select : {
                                        name : true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async claimDeliveryOrderService(userId : string, orderId : string){
        const availableOrder = await prisma.order.findFirst({
            where : {
                id : orderId,
                delivery_person_id : null,
                status : {
                    in : ['pending', 'paid', 'shipped']
                }
            }
        });

        if(!availableOrder){
            throw new Error('Order is not available for claiming');
        }

        return prisma.$transaction(async (tx) => {
            const order = await tx.order.update({
                where : {
                    id : orderId
                },
                data : {
                    status : 'shipped',
                    delivery_person_id : userId,
                    assigned_at : new Date(),
                    delivery_location_updated_at : new Date()
                },
                include : {
                    address : true,
                    order_items : {
                        include : {
                            product : {
                                select : {
                                    id : true,
                                    name : true,
                                    image_url : true,
                                    brand : {
                                        select : {
                                            name : true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            await tx.deliveryMessage.create({
                data : {
                    order_id : orderId,
                    sender : 'system',
                    message : 'Order claimed by delivery partner and marked as shipped.'
                }
            });

            return order;
        });
    }

    async updateDeliveryLocationService(userId : string, orderId : string, latitude : number, longitude : number){
        const order = await prisma.order.findFirst({
            where : {
                id : orderId,
                delivery_person_id : userId
            }
        });

        if(!order){
            throw new Error('Order not found');
        }

        return prisma.order.update({
            where : {
                id : orderId
            },
            data : {
                delivery_latitude : latitude,
                delivery_longitude : longitude,
                delivery_location_updated_at : new Date()
            }
        });
    }

    async getDeliveryTrackerPayloadService(userId : string , orderId : string){
        const order = await prisma.order.findFirst({
            where : {
                id : orderId,
                delivery_person_id : userId
            },
            include : {
                address : true,
                order_items : {
                    include : {
                        product : {
                            select : {
                                id : true,
                                name : true,
                                image_url : true,
                                brand : {
                                    select : {
                                        name : true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if(!order){
            throw new Error('Order not found');
        }

        const messages = await prisma.deliveryMessage.findMany({
            where : {
                order_id : orderId
            },
            orderBy : {
                created_at : 'asc'
            }
        });

        return {
            order,
            messages
        };
    }

    async postDeliveryMessageAsDeliveryService(userId : string , orderId : string , message : string){
        const order = await prisma.order.findFirst({
            where : {
                id : orderId,
                delivery_person_id : userId
            }
        });

        if(!order){
            throw new Error('Order not found');
        }

        return prisma.deliveryMessage.create({
            data : {
                order_id : orderId,
                sender : 'delivery',
                message
            }
        });
    }

    private async markMessagesSeenByRoleService(
        orderId: string,
        reader: 'customer' | 'delivery',
        messageIds: string[],
    ) {
        if (messageIds.length === 0) {
            return {
                updatedCount: 0,
                messages: [],
            };
        }

        const oppositeSender = reader === 'customer' ? 'delivery' : 'customer';

        const result = await prisma.deliveryMessage.updateMany({
            where: {
                id: {
                    in: messageIds,
                },
                order_id: orderId,
                sender: oppositeSender,
                read_at: null,
            },
            data: {
                read_at: new Date(),
            },
        });

        const messages = await prisma.deliveryMessage.findMany({
            where: {
                id: {
                    in: messageIds,
                },
                order_id: orderId,
                sender: oppositeSender,
            },
            orderBy: {
                created_at: 'asc',
            },
        });

        return {
            updatedCount: result.count,
            messages,
        };
    }

    async markDeliveryMessagesSeenAsCustomerService(
        userId: string,
        orderId: string,
        messageIds: string[],
    ) {
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                user_id: userId,
            },
        });

        if (!order) {
            throw new Error('Order not found');
        }

        return this.markMessagesSeenByRoleService(orderId, 'customer', messageIds);
    }

    async markDeliveryMessagesSeenAsDeliveryService(
        userId: string,
        orderId: string,
        messageIds: string[],
    ) {
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                delivery_person_id: userId,
            },
        });

        if (!order) {
            throw new Error('Order not found');
        }

        return this.markMessagesSeenByRoleService(orderId, 'delivery', messageIds);
    }

    async markDeliveryMessageSeenFromSocketService(
        orderId: string,
        reader: string,
        messageId: string,
    ) {
        if (reader !== 'customer' && reader !== 'delivery') {
            return null;
        }

        const result = await this.markMessagesSeenByRoleService(orderId, reader, [messageId]);
        return result.messages.length > 0 ? result.messages[0] : null;
    }
}
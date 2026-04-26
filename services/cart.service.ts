import {prisma} from '../model/prisma'

export class cart_services {
    constructor(){}

    async getCartService(userId : string){
        
        const cart = await prisma.cart.findUnique({
            where : {
                user_id : userId
            },
            include : {
                cart_items : {
                    include : {
                        product : {
                            select : {
                                id : true ,
                                name : true ,
                                image_url : true ,
                                sizes : {
                                    select : {  
                                        size : true ,
                                        price : true,
                                        stock : true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        const items = cart?.cart_items ?? [];

        // summary
        const subtotal = items.reduce((sum , it) =>{
            const sizeprice = it.product.sizes.find(s => s.size === it.size)?.price ?? 0 ;
            return sum + it.quantity * Number(sizeprice);
        }, 0)

        const tax = subtotal * 0.15 ; // 15% tax
        const total = subtotal + tax ;

        return {
            items,
            summary : {
                subtotal : subtotal.toFixed(2) ,
                tax : tax.toFixed(2) ,
                total : total.toFixed(2)
            }
        } ;
    }

    async addToCartService (userId : string , productId : string , size : string , quantity : number = 1){

        const cart = await prisma.cart.findUnique({
            where : {
                user_id : userId
            }
        });

        if(!cart){
            throw new Error("Cart not found for user");
        }

        const productsize = await prisma.productSize.findUnique({
            where : {
                product_id_size : {
                    product_id : productId ,
                    size : size
                }
            }
        });

        if(!productsize){
            throw new Error("Product size not found");
        }

        if(productsize.stock < quantity){
            throw new Error("Not enough stock");
        }

        const existingCartItem = await prisma.cartItem.findUnique({
            where : {
                cart_id_product_id_size : {
                    cart_id : cart.id ,
                    product_id : productId ,
                    size : size
                }
            }
        });

        if(existingCartItem){
            const nextQuantity = existingCartItem.quantity + quantity;
            if (nextQuantity > productsize.stock) {
                throw new Error("Quantity exceeds available stock");
            }

            // update quantity
            await prisma.cartItem.update({
                where : {id : existingCartItem.id} ,
                data : {
                    quantity : nextQuantity
                }                
            });            
        }
        else{
            await prisma.cartItem.create({
                data : {
                    cart_id : cart.id ,
                    product_id : productId ,
                    size : size ,
                    quantity : quantity
                }
            }); 
        }
        return this.getCartService(userId) ;
    }

    async  updateCartItemService (userId : string , productId : string , size : string , quantity : number){

        const cart = await prisma.cart.findUnique({
            where : {
                user_id : userId
            }
        });

        if(!cart){
            throw new Error("Cart not found for user");
        }

        const productsize = await prisma.productSize.findUnique({
            where: {
                product_id_size: {
                    product_id: productId,
                    size: size
                }
            }
        });

        if (!productsize) {
            throw new Error("Product size not found");
        }

        if(quantity <= 0){
            // delete item
            await prisma.cartItem.delete({
                where : {
                    cart_id_product_id_size : {
                        cart_id : cart.id ,
                        product_id : productId ,
                        size : size
                    }
                }
            });
        }
        else{
            if (quantity > productsize.stock) {
                throw new Error("Quantity exceeds available stock");
            }

            // update quantity
            await prisma.cartItem.update({
                where : {
                    cart_id_product_id_size : {
                        cart_id : cart.id ,
                        product_id : productId ,
                        size : size
                    }
                },
                data : {
                    quantity : quantity
                }
            });
        }
        return this.getCartService(userId) ;
    }

    async removeFromCartService  (userId : string , productId : string , size : string){

        const cart = await prisma.cart.findUnique({
            where : {
                user_id : userId
            }
        });

        if(!cart){
            throw new Error("Cart not found for user");
        }

        await prisma.cartItem.deleteMany({
            where : {
                cart_id : cart.id,
                product_id : productId,
                size : size
            }
        });

        return {message : "Item removed from cart"} ;
    }

    async clearCartService (userId : string){

        const cart = await prisma.cart.findUnique({
            where : {
                user_id : userId
            }
        });

        if(!cart){
            throw new Error("Cart not found for user");
        }

        await prisma.cartItem.deleteMany({
            where : {
                cart_id : cart.id
            }
        });

        return {message : "Cart cleared"} ;
    }
}

import {prisma} from "../model/prisma" ;

export class payment_services {
    constructor(){}

    async getPaymentMethodsService (userId : string){

        const paymentMethods = await prisma.paymentMethod.findMany({
            where : {
                user_id : userId
            },
            orderBy : {
                id : "desc"
            }
        });

        return paymentMethods;
    }

    async addPaymentMethodService (userId : string , data : {
        type: string;       // "card" or "digital_wallet"
        provider?: string;  // "visa", "mastercard", "apple_pay"
        last4?: string;     // "4242"
    }){

        const paymentMethod = await prisma.paymentMethod.create({
            data : {
                user_id : userId ,
                ...data
            }
        });

        return paymentMethod;
    }

    async updatePaymentMethodService (
        userId : string ,
        paymentMethodId : string ,
        data : {
            type?: string;
            provider?: string;
            last4?: string;
        }
    ){

        const paymentMethod = await prisma.paymentMethod.findFirst({
            where : {
                id : paymentMethodId,
                user_id : userId
            }
        });

        if(!paymentMethod) throw new Error("Payment method not found") ;

        const updatedPaymentMethod = await prisma.paymentMethod.update({
            where : {
                id : paymentMethodId
            },
            data
        });

        return updatedPaymentMethod;
    }

    async deletePaymentMethodService (userId : string , paymentMethodId : string){

        const paymentMethod = await prisma.paymentMethod.findFirst({
            where : {
                id : paymentMethodId,
                user_id : userId
             }
        });
        
        if(!paymentMethod) throw new Error("Payment method not found") ;

        await prisma.paymentMethod.delete({
            where : {
                id : paymentMethodId
             }
        });

        return { message : "Payment method deleted successfully" } ;
    }
}
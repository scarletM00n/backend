import {prisma} from "../model/prisma" ;

export class address_services {
    constructor(){}

    // getaddress
    async getAddressService(userId : string){

        const addresses = await prisma.address.findMany({
            where : {
                user_id : userId
            },
            orderBy : [
                {
                    is_default : "desc"
                }
                ,
                {
                created_at : "desc"
            }]
        });

        return addresses ;

    }

    // add address
    async addAddressService(userId : string , data : {
        label: string;
        street: string;
        city: string;
        state: string;
        zip_code: string;
        country: string;
        is_default?: boolean;
        latitude?: number;
        longitude?: number;
    }){

        if(data.is_default){
            await prisma.address.updateMany({
                where : {
                    user_id : userId
                },
                data : {
                    is_default : false
                }
            });
        }

        const address = await prisma.address.create({
            data : {
                user_id : userId ,
                ...data
            }
        });
        return address;
    }

    // update address
    async updateAddressService (userId : string , addressId : string , data : {
        label?: string;
        street?: string;
        city?: string;
        state?: string;
        zip_code?: string;
        country?: string;
        is_default?: boolean;
        latitude?: number;
        longitude?: number;
    }){

        const address = await prisma.address.findFirst({
            where : {
                id : addressId ,
                user_id : userId
            }
        });

        if(!address){
            throw new Error("Address not found");
        }

        if(data.is_default){
            await prisma.address.updateMany({
                where : {
                    user_id : userId
                },
                data : {
                    is_default : false
                }
            });
        }

        const updatedAddress = await prisma.address.update({
            where : {
                id : addressId
            },
            data
        });

        return updatedAddress ;
    }

    async deleteAddressService(userId : string , addressId : string){

        const address = await prisma.address.findFirst({
            where : {
                id : addressId,
                user_id : userId
            }
        });

        if(!address){
            throw new Error("Address not found");
        }

        await prisma.address.delete({
            where : {
                id : addressId
            }
        });

        if(address.is_default){
            const nextAddress = await prisma.address.findFirst({
                where : {
                    user_id : userId
                },
                orderBy : {
                    created_at : "desc"
                }
            });

            if(nextAddress){
                await prisma.address.update({
                    where : {
                        id : nextAddress.id
                    },
                    data : {
                        is_default : true
                    }
                });
            }
        }

        return { message : "Address deleted successfully" };
    }
    
}
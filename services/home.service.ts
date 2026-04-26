import {prisma} from "../model/prisma";

export class home_services {
    constructor(){}   
    
    async getHomeData (baseUrl: string){

        const toAbsoluteUrl = (imageUrl: string | null | undefined) => {
            const value = (imageUrl ?? "").trim();
            if (!value) return "";
            if (value.startsWith("http://") || value.startsWith("https://")) {
                return value;
            }
            if (value.startsWith("/")) {
                return `${baseUrl}${value}`;
            }
            return `${baseUrl}/${value}`;
        };

         // Banners
        const banners = await prisma.banner.findMany({ take: 5 }).catch(() => []);

         // New Arrivals
        const products = await prisma.product.findMany({
            take: 10,
            orderBy: [
                { is_new_arrival: 'desc' },
                { created_at: 'desc' },
            ],
            include: {
                brand: {
                    select: {
                        name: true,
                    },
                },
                sizes: {
                    where: {
                        stock: {
                            gt: 0,
                        },
                    },
                    select: {
                        size: true,
                        price: true,
                        stock: true,
                    },
                    orderBy: {
                        price: 'asc',
                    },
                },
            },
        }).catch(() => []);

        const normalizedBanners = banners.map((banner) => ({
            ...banner,
            image_url: toAbsoluteUrl(banner.image_url),
        }));

        const normalizedProducts = products.map((product) => ({
            ...product,
            image_url: toAbsoluteUrl(product.image_url),
        }));
       
        
        return {
            banners: normalizedBanners,
            new_arrivals : normalizedProducts,            
        };
    }
}
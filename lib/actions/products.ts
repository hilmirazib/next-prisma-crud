"use server";
import { unstable_cache as cache, revalidateTag } from "next/cache";

import { prisma } from "@/lib/prisma";

// use 'prisma' to interact with your database
// to create, read, update, or delete data
interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  category: string;
  // update our type to accept an array of image URLs
  images?: string[];
}
// create product input
export async function createProduct(product: CreateProductInput) {
  try {
    const newProduct = await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        images: {
          create: product.images?.map((url) => ({
            url,
          })),
        },
      },
    });
    return newProduct;
  } catch (error) {
    console.error("Error creating product:", error);
    throw new Error("Error creating product");
  }
}

// get list products

async function _getProductById(id: number) {
  try {
    const product = await prisma.product.findUnique({
      where: {
        id,
      },
      include: {
        images: true,
        reviews: true,
      },
    });
    return product;
  } catch (error) {
    return null;
  }
}

export const getProductById = cache(_getProductById, ["getProductById"], {
  tags: ["Product"],
  revalidate: 60,
});

// update
export async function updateProduct(id: number, product: CreateProductInput) {
  try {
    const updatedProduct = await prisma.product.update({
      // where statement, just like reading a record
      where: { id },
      // data object is the exact same as 'create'.
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        images: {
          // delete previous images and create new ones
          deleteMany: {},
          create: product.images?.map((url) => ({ url })),
        },
      },
    });
    revalidateTag("Product");
    return updatedProduct;
  } catch (error) {
    return null;
  }
}

// delete

export async function deleteProduct(id: number) {
  try {
    await prisma.product.delete({
      where: {
        id: id,
      },
    });
    revalidateTag("Product");
    return true;
  } catch (error) {
    return false;
  }
}

// get All products

export async function getProducts({
  page = 1,
  name,
  minPrice,
  category,
}: {
  page?: number;
  name?: string;
  minPrice?: string;
  category?: string;
}) {
  const resultsPerPage = 5;
  const skip = (page - 1) * resultsPerPage;
  const filterCategory = category !== "all";
  try {
    const allProducts = await prisma.product.findMany({
      include: {
        images: true,
        reviews: true,
      },
      where: {
        name: {
          contains: name,
          mode: "insensitive",
        },
        ...(filterCategory && { category }),
        ...(minPrice && {
          price: {
            gte: parseInt(minPrice),
          },
        }),
      },
      skip,
      take: resultsPerPage,
    });

    const products = allProducts.map((product) => ({
      ...product,
      rating:
        Math.floor(
          product.reviews.reduce((acc, review) => acc + review.rating, 0) / product.reviews.length
        ) || 0,
      image: product.images[0]?.url,
    }));

    return products;
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

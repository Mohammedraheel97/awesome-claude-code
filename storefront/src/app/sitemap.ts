import type { MetadataRoute } from 'next';
import { getCommerce } from '@/lib/commerce';
import { siteConfig } from '@/lib/config';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const commerce = getCommerce();
  const [productHandles, collectionHandles] = await Promise.all([
    commerce.listProductHandles().catch(() => [] as string[]),
    commerce.listCollectionHandles().catch(() => [] as string[]),
  ]);
  const staticPaths = ['', '/collections', '/about', '/contact', '/faqs', '/shipping', '/returns', '/privacy', '/terms'];
  return [
    ...staticPaths.map((path) => ({ url: `${siteConfig.url}${path}`, changeFrequency: 'weekly' as const })),
    ...collectionHandles.map((handle) => ({ url: `${siteConfig.url}/collections/${handle}`, changeFrequency: 'daily' as const })),
    ...productHandles.map((handle) => ({ url: `${siteConfig.url}/products/${handle}`, changeFrequency: 'daily' as const })),
  ];
}

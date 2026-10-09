import type { Locale } from '@/lib/i18n';

export type Money = { amount: string; currencyCode: string };

export type Image = { url: string; altText: string | null; width: number | null; height: number | null };

export type SelectedOption = { name: string; value: string };

export type ProductOption = { name: string; values: string[] };

export type Variant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null;
  selectedOptions: SelectedOption[];
  image: Image | null;
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  vendor: string;
  tags: string[];
  availableForSale: boolean;
  priceRange: { min: Money; max: Money };
  compareAtPriceMin: Money | null;
  featuredImage: Image | null;
  images: Image[];
  options: ProductOption[];
  /** Empty for listing responses; populated on product detail responses. */
  variants: Variant[];
};

export type Collection = {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: Image | null;
};

export type PageInfo = { hasNextPage: boolean; endCursor: string | null };

export type CartLine = {
  id: string;
  quantity: number;
  variantId: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  image: Image | null;
  unitPrice: Money;
  lineTotal: Money;
  availableForSale: boolean;
};

export type Cart = {
  checkoutUrl: string | null;
  totalQuantity: number;
  subtotal: Money;
  lines: CartLine[];
};

export type SortOption = 'featured' | 'best-selling' | 'price-asc' | 'price-desc' | 'newest' | 'title';

export const SORT_OPTIONS: SortOption[] = ['featured', 'best-selling', 'price-asc', 'price-desc', 'newest', 'title'];

export type ListOptions = {
  locale: Locale;
  first?: number;
  after?: string | null;
  sort?: SortOption;
  availableOnly?: boolean;
};

export type ListResult = { products: Product[]; pageInfo: PageInfo };

export type CartResult = {
  cart: Cart;
  /** Opaque value to store in the cart cookie. `null` means "clear the cookie". */
  token: string | null;
};

export class CommerceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommerceError';
  }
}

export interface CommerceProvider {
  readonly mode: 'shopify' | 'sample';
  listCollections(locale: Locale): Promise<Collection[]>;
  getCollection(handle: string, options: ListOptions): Promise<(ListResult & { collection: Collection }) | null>;
  getProduct(handle: string, locale: Locale): Promise<Product | null>;
  getRelatedProducts(product: Product, locale: Locale): Promise<Product[]>;
  searchProducts(query: string, options: ListOptions): Promise<ListResult>;
  listProductHandles(): Promise<string[]>;
  listCollectionHandles(): Promise<string[]>;
  getCart(token: string | null, locale: Locale): Promise<CartResult>;
  addToCart(token: string | null, variantId: string, quantity: number, locale: Locale): Promise<CartResult>;
  updateCartLine(token: string | null, lineId: string, quantity: number, locale: Locale): Promise<CartResult>;
  removeCartLine(token: string | null, lineId: string, locale: Locale): Promise<CartResult>;
}

export const MAX_LINE_QUANTITY = 10;

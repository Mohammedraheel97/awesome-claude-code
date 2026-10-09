/**
 * SAMPLE CATALOG — placeholder data used when Shopify is not connected.
 *
 * These products, prices and descriptions are invented for development and
 * preview only. They are not the brand's real inventory. Replace them by
 * connecting the Shopify Storefront API (see README.md).
 */

export type Localized = { ar: string; en: string };

export type SampleCollection = { handle: string; title: Localized; description: Localized };

export type SampleVariant = { values: string[]; price: string; compareAt?: string; available?: boolean };

export type SampleProduct = {
  handle: string;
  title: Localized;
  description: Localized;
  vendor: string;
  tags: string[];
  collections: string[];
  optionNames: Localized[];
  variants: SampleVariant[];
};

export const sampleCollections: SampleCollection[] = [
  {
    handle: 'chocolate',
    title: { ar: 'شوكولاتة', en: 'Chocolate' },
    description: { ar: 'شوكولاتة داكنة وبالحليب ومحشوة.', en: 'Dark, milk and filled chocolate.' },
  },
  {
    handle: 'sweets',
    title: { ar: 'حلويات', en: 'Sweets' },
    description: { ar: 'حلويات شرقية وغربية للمشاركة.', en: 'Eastern and western sweets to share.' },
  },
  {
    handle: 'snacks',
    title: { ar: 'سناكات', en: 'Snacks' },
    description: { ar: 'سناكات مالحة ومقرمشة لكل يوم.', en: 'Savoury and crunchy snacks for every day.' },
  },
  {
    handle: 'eid-sweets',
    title: { ar: 'حلويات العيد', en: 'Eid sweets' },
    description: { ar: 'علب ومجموعات للاحتفال بالعيد.', en: 'Boxes and selections for Eid celebrations.' },
  },
];

export const sampleProducts: SampleProduct[] = [
  {
    handle: 'belgian-dark-chocolate-box',
    title: { ar: 'علبة شوكولاتة بلجيكية داكنة', en: 'Belgian dark chocolate box' },
    description: {
      ar: 'تشكيلة من الشوكولاتة الداكنة في علبة هدايا أنيقة.',
      en: 'An assortment of dark chocolate in a gift-ready box.',
    },
    vendor: 'Almoallem',
    tags: ['chocolate', 'gift'],
    collections: ['chocolate', 'eid-sweets'],
    optionNames: [{ ar: 'الحجم', en: 'Size' }],
    variants: [
      { values: ['250 g'], price: '3.500' },
      { values: ['500 g'], price: '6.000', compareAt: '6.500' },
    ],
  },
  {
    handle: 'milk-chocolate-bar-trio',
    title: { ar: 'ثلاث ألواح شوكولاتة بالحليب', en: 'Milk chocolate bar trio' },
    description: { ar: 'ثلاث ألواح بالحليب بنكهات متنوعة.', en: 'Three milk chocolate bars in mixed flavours.' },
    vendor: 'Almoallem',
    tags: ['chocolate'],
    collections: ['chocolate'],
    optionNames: [],
    variants: [{ values: ['Default'], price: '1.250' }],
  },
  {
    handle: 'caramel-chocolate-truffles',
    title: { ar: 'ترافل شوكولاتة بالكراميل', en: 'Caramel chocolate truffles' },
    description: { ar: 'ترافل ناعمة بحشوة الكراميل.', en: 'Smooth truffles with a soft caramel centre.' },
    vendor: 'Almoallem',
    tags: ['chocolate', 'truffle'],
    collections: ['chocolate'],
    optionNames: [{ ar: 'العبوة', en: 'Pack' }],
    variants: [
      { values: ['12 pcs'], price: '2.750' },
      { values: ['24 pcs'], price: '4.900' },
    ],
  },
  {
    handle: 'hazelnut-praline-spread',
    title: { ar: 'معجون البندق بالبرالين', en: 'Hazelnut praline spread' },
    description: { ar: 'معجون بندق غني بقطع البرالين.', en: 'A rich hazelnut spread with praline pieces.' },
    vendor: 'Almoallem',
    tags: ['spread'],
    collections: ['chocolate', 'sweets'],
    optionNames: [{ ar: 'الحجم', en: 'Size' }],
    variants: [
      { values: ['350 g'], price: '2.200' },
      { values: ['700 g'], price: '3.900', available: false },
    ],
  },
  {
    handle: 'pistachio-baklava-tray',
    title: { ar: 'صينية بقلاوة بالفستق', en: 'Pistachio baklava tray' },
    description: { ar: 'بقلاوة طازجة محشوة بالفستق الحلبي.', en: 'Fresh baklava layered with pistachio.' },
    vendor: 'Almoallem',
    tags: ['sweets', 'baklava'],
    collections: ['sweets', 'eid-sweets'],
    optionNames: [{ ar: 'الحجم', en: 'Size' }],
    variants: [
      { values: ['16 pcs'], price: '4.500' },
      { values: ['32 pcs'], price: '8.250', compareAt: '9.000' },
    ],
  },
  {
    handle: 'date-filled-biscuits',
    title: { ar: 'بسكويت بحشوة التمر', en: 'Date-filled biscuits' },
    description: { ar: 'بسكويت مقرمش بحشوة التمر الطبيعية.', en: 'Crisp biscuits with a natural date filling.' },
    vendor: 'Almoallem',
    tags: ['sweets'],
    collections: ['sweets'],
    optionNames: [{ ar: 'العبوة', en: 'Pack' }],
    variants: [
      { values: ['6 pcs'], price: '1.100' },
      { values: ['12 pcs'], price: '2.000' },
    ],
  },
  {
    handle: 'sesame-brittle',
    title: { ar: 'قطر السمسم', en: 'Sesame brittle' },
    description: { ar: 'قطع سمسم مقرمشة بالعسل.', en: 'Crunchy sesame bars bound with honey.' },
    vendor: 'Almoallem',
    tags: ['sweets'],
    collections: ['sweets'],
    optionNames: [],
    variants: [{ values: ['Default'], price: '0.900' }],
  },
  {
    handle: 'rose-marzipan-box',
    title: { ar: 'علبة مارزيبان بالورد', en: 'Rose marzipan box' },
    description: { ar: 'مارزيبان بنكهة الورد في علبة مزينة.', en: 'Rose-flavoured marzipan in a decorated box.' },
    vendor: 'Almoallem',
    tags: ['sweets', 'gift'],
    collections: ['sweets', 'eid-sweets'],
    optionNames: [{ ar: 'العبوة', en: 'Pack' }],
    variants: [{ values: ['18 pcs'], price: '5.100', available: false }],
  },
  {
    handle: 'assorted-nut-snack-mix',
    title: { ar: 'خليط المكسرات المشكلة', en: 'Assorted nut snack mix' },
    description: { ar: 'خليط من المكسرات المحمصة والمملحة.', en: 'A mix of roasted and lightly salted nuts.' },
    vendor: 'Almoallem',
    tags: ['snacks', 'nuts'],
    collections: ['snacks'],
    optionNames: [{ ar: 'الحجم', en: 'Size' }],
    variants: [
      { values: ['200 g'], price: '1.600' },
      { values: ['400 g'], price: '2.950' },
    ],
  },
  {
    handle: 'spiced-popcorn',
    title: { ar: 'فشار بالتوابل', en: 'Spiced popcorn' },
    description: { ar: 'فشار مقرمش بنكهات مختارة.', en: 'Crisp popcorn in selected flavours.' },
    vendor: 'Almoallem',
    tags: ['snacks'],
    collections: ['snacks'],
    optionNames: [{ ar: 'النكهة', en: 'Flavour' }],
    variants: [
      { values: ['Cheese'], price: '0.800' },
      { values: ['Caramel'], price: '0.800' },
    ],
  },
  {
    handle: 'roasted-chickpea-snack',
    title: { ar: 'حمص مقلي مقرمش', en: 'Roasted chickpea snack' },
    description: { ar: 'حمص مقرمش محمّص بالتوابل.', en: 'Crunchy roasted chickpeas with spices.' },
    vendor: 'Almoallem',
    tags: ['snacks'],
    collections: ['snacks'],
    optionNames: [],
    variants: [{ values: ['Default'], price: '1.050' }],
  },
  {
    handle: 'eid-maamoul-selection',
    title: { ar: 'تشكيلة معمول العيد', en: 'Eid maamoul selection' },
    description: { ar: 'معمول بالتمر والجوز والفستق في علبة العيد.', en: 'Date, walnut and pistachio maamoul in an Eid box.' },
    vendor: 'Almoallem',
    tags: ['sweets', 'eid'],
    collections: ['eid-sweets'],
    optionNames: [{ ar: 'العبوة', en: 'Pack' }],
    variants: [
      { values: ['500 g'], price: '4.200' },
      { values: ['1 kg'], price: '7.900', compareAt: '8.400' },
    ],
  },
];

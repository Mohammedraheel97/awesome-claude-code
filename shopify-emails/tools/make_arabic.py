"""Build Arabic (RTL) versions of the 89 Shirt Shop templates from the English sources.
Each replacement must match at least once so a changed English file fails loudly."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

def apply(src, pairs, name):
    for old, new in pairs:
        if old not in src:
            sys.exit(f"[{name}] not found: {old!r}")
        src = src.replace(old, new)
    return src

# ---------------------------------------------------------------- order confirmation
OC = [
    ("{% capture email_title %}Thank you for your order!{% endcapture %}", "{% capture email_title %}شكراً لطلبك!{% endcapture %}"),
    ("{% assign buyer_email_rtl = false %}{% if locale_direction == 'rtl' %}{% assign buyer_email_rtl = true %}{% endif %}", "{% assign buyer_email_rtl = true %}"),
    ('<html lang="en"', '<html lang="ar"'),
    ("You’ll get a confirmation email after completing your payment.", "ستصلك رسالة تأكيد بعد إتمام الدفع."),
    ("Your payment is being processed. You'll get an email when your order is confirmed.", "جارٍ معالجة الدفع، وستصلك رسالة عند تأكيد طلبك."),
    ("Hi {{ bo }}{{ customer.first_name }}{{ bc }}, we received your order. Your payment method will be charged when your order is ready to be fulfilled. We'll notify you when it's on its way.",
     "مرحباً {{ bo }}{{ customer.first_name }}{{ bc }}، استلمنا طلبك. سيتم خصم المبلغ من وسيلة الدفع عندما يصبح طلبك جاهزاً للتجهيز، وسنبلغك فور شحنه."),
    ("You’ll receive an email when your order is ready for pickup.", "ستصلك رسالة عندما يصبح طلبك جاهزاً للاستلام."),
    ("Hi {{ bo }}{{ customer.first_name }}{{ bc }}, we're getting your order ready for delivery.", "مرحباً {{ bo }}{{ customer.first_name }}{{ bc }}، نقوم الآن بتجهيز طلبك للتوصيل."),
    ("We're getting your order ready to be shipped. We will notify you when it has been sent.", "نقوم الآن بتجهيز طلبك للشحن، وسنبلغك فور إرساله."),
    ("Delivery information:", "معلومات التوصيل:"),
    ("Estimated delivery", "موعد التوصيل المتوقع"),
    ("Your gift card recipient will receive an email with their gift card code.", "سيتلقى مستلم بطاقة الهدية رسالة تحتوي على رمز البطاقة."),
    ("You’ll receive separate emails for any gift cards.", "ستصلك رسائل منفصلة لبطاقات الهدايا."),
    ("Order {{ order_name }} is locked in. Here’s everything you ordered from {{ shop.name }}.", "تم تأكيد طلبك {{ order_name }}. إليك كل ما طلبته من {{ shop.name }}."),
    ("Order&nbsp;<span", "طلب&nbsp;<span"),
    ("PO number {{ lo }}", "رقم أمر الشراء {{ lo }}"),
    ("{% if has_pending_payment %}Payment pending{% else %}Order confirmed{% endif %}", "{% if has_pending_payment %}الدفع قيد الانتظار{% else %}تم تأكيد الطلب{% endif %}"),
    ("Thank you{% if customer.first_name != blank %},<br>", "شكراً لك{% if customer.first_name != blank %}،<br>"),
    (">Amount<", ">المبلغ<"),
    ("View your order&nbsp;&rarr;", "عرض طلبك&nbsp;&larr;"),
    ("Track order with{% else %}Download to track with{% endif %}", "تتبّع الطلب عبر{% else %}حمّل التطبيق للتتبّع عبر{% endif %}"),
    ("or <a href=\"{{ shop.url }}\"", "أو <a href=\"{{ shop.url }}\""),
    ("Visit our store&nbsp;&rarr;", "زُر متجرنا&nbsp;&larr;"),
    ("Visit our store", "زُر متجرنا"),
    (">Your fit<", ">إطلالتك<"),
    (">Order summary<", ">ملخص الطلب<"),
    (">{{ bo }}{{ section.delivery_method_name }}{{ bc }} items</div>", ">منتجات {{ bo }}{{ section.delivery_method_name }}{{ bc }}</div>"),
    (">Refunded<", ">مسترد<"),
    ("}Free{", "}مجاني{"),
    ('">Free</span>', '">مجاني</span>'),
    ("&middot; Free{", "&middot; مجاني{"),
    (">Subtotal<", ">المجموع الفرعي<"),
    ("Order discount{% else %}Order discounts", "خصم الطلب{% else %}خصومات الطلب"),
    (">Fees<", ">الرسوم<"),
    (">Shipping</td>", ">الشحن</td>"),
    (">Pickup</td>", ">الاستلام</td>"),
    ("Pickup{% else %}Shipping{% endif %}", "الاستلام{% else %}الشحن{% endif %}"),
    (">Duties<", ">الرسوم الجمركية<"),
    (">Taxes<", ">الضرائب<"),
    (">Tip<", ">الإكرامية<"),
    ("You saved {{ bo }}", "وفّرت {{ bo }}"),
    (">Cash rounding<", ">التقريب النقدي<"),
    (">Total</td>", ">الإجمالي</td>"),
    (">Total paid today<", ">المدفوع اليوم<"),
    ("Total due on receipt", "المستحق عند الاستلام"),
    ("Total due on fulfillment", "المستحق عند التجهيز"),
    ("Total due {{ bo }}", "المستحق في {{ bo }}"),
    (">Paid<br>", ">مدفوع<br>"),
    (">Waived<", ">تم الإعفاء<"),
    ("Gift card (ending with ", "بطاقة هدية (تنتهي بـ "),
    (" (ending in ", " (تنتهي بـ "),
    ("\n                                  Refund\n", "\n                                  استرداد\n"),
    ("{% capture link_text %}View{% endcapture %}", "{% capture link_text %}عرض{% endcapture %}"),
    ("View the CNY total in WeChat", "اعرض الإجمالي باليوان في WeChat"),
    ("View the CNY total in Alipay", "اعرض الإجمالي باليوان في Alipay"),
    (": Due {{ bo }}", ": مستحق في {{ bo }}"),
    ("ending with {{ lo }}", "تنتهي بـ {{ lo }}"),
    ("Paid with Shop Pay installments", "مدفوع بأقساط Shop Pay"),
    ("/month for {{ lo }}", " شهرياً لمدة {{ lo }}"),
    ("{{ lc }} months</span>", "{{ lc }} أشهر</span>"),
    ("Gift card balance - <b>", "رصيد بطاقة الهدية - <b>"),
    ("Delivery &amp; payment", "التوصيل والدفع"),
    (">Customer information<", ">معلومات العميل<"),
    (">Shipping address<", ">عنوان الشحن<"),
    (">Billing address<", ">عنوان الفوترة<"),
    (">Location<", ">الموقع<"),
    (">Payment</h4>", ">الدفع</h4>"),
    ("Bought with <a", "تم الشراء عبر <a"),
    (">Shipping method<", ">طريقة الشحن<"),
    (">Questions?<", ">عندك سؤال؟<"),
    ("Reply to this email or message us on WhatsApp — we’re quick.", "رد على هذه الرسالة أو راسلنا على واتساب — نرد بسرعة."),
    (">WhatsApp us<", ">راسلنا على واتساب<"),
    ("'Hi 89, about my order '", "'مرحباً 89، بخصوص طلبي '"),
    (">Shop</a>", ">المتجر</a>"),
    (">Instagram</a>", ">إنستغرام</a>"),
    (">WhatsApp</a>", ">واتساب</a>"),
    ("If you have any questions, reply to this email or contact us at", "إذا كان لديك أي استفسار، رد على هذه الرسالة أو تواصل معنا على"),
    ('<div class="x-wordmark" style="', '<div class="x-wordmark" dir="ltr" style="text-align:right;'),
    # Arabic typography: taller lines, no tracking (it breaks joined letters)
    ("font-size:52px;line-height:50px", "font-size:48px;line-height:66px"),
    (".x-hero { font-size: 40px !important; line-height: 40px !important; }", ".x-hero { font-size: 38px !important; line-height: 54px !important; }"),
    (".x-wordmark { font-size: 34px !important; line-height: 34px !important; }", ".x-wordmark { font-size: 34px !important; line-height: 44px !important; }"),
    ("font-size:26px;line-height:28px", "font-size:26px;line-height:38px"),
    ("font-size:22px;line-height:26px", "font-size:22px;line-height:34px"),
    ("font-size:46px;line-height:44px", "font-size:46px;line-height:56px"),
]

# ---------------------------------------------------------------- shipping confirmation
SHIP = [
    ("{% assign buyer_email_rtl = false %}{% if locale_direction == 'rtl' %}{% assign buyer_email_rtl = true %}{% endif %}", "{% assign buyer_email_rtl = true %}"),
    ('<html lang="en"', '<html lang="ar"'),
    ("{% capture email_title %}Your order is on the way{% endcapture %}", "{% capture email_title %}طلبك في الطريق إليك{% endcapture %}"),
    ("{% capture hero_1 %}Your fit is{% endcapture %}{% capture hero_2 %}on the way.{% endcapture %}", "{% capture hero_1 %}إطلالتك{% endcapture %}{% capture hero_2 %}في الطريق إليك.{% endcapture %}"),
    ("{% capture email_body %}Your order is on the way. Track your shipment to see the delivery status.{% endcapture %}", "{% capture email_body %}طلبك في الطريق إليك. تتبّع شحنتك لمعرفة حالة التوصيل.{% endcapture %}"),
    ("{% capture email_title %}The last items in your order are on the way{% endcapture %}", "{% capture email_title %}آخر منتجات طلبك في الطريق إليك{% endcapture %}"),
    ("{% capture hero_1 %}The last items{% endcapture %}{% capture hero_2 %}are on the way.{% endcapture %}", "{% capture hero_1 %}آخر المنتجات{% endcapture %}{% capture hero_2 %}في الطريق إليك.{% endcapture %}"),
    ("{% capture email_body %}The last items in your order are on the way. Track your shipment to see the delivery status.{% endcapture %}", "{% capture email_body %}آخر منتجات طلبك في الطريق إليك. تتبّع شحنتك لمعرفة حالة التوصيل.{% endcapture %}"),
    ("{% capture email_title %}Some items in your order are on the way{% endcapture %}", "{% capture email_title %}بعض منتجات طلبك في الطريق إليك{% endcapture %}"),
    ("{% capture hero_1 %}Some items{% endcapture %}{% capture hero_2 %}are on the way.{% endcapture %}", "{% capture hero_1 %}بعض المنتجات{% endcapture %}{% capture hero_2 %}في الطريق إليك.{% endcapture %}"),
    ("{% capture email_body %}Some items in your order are on the way. Track your shipment to see the delivery status.{% endcapture %}", "{% capture email_body %}بعض منتجات طلبك في الطريق إليك. تتبّع شحنتك لمعرفة حالة التوصيل.{% endcapture %}"),
    ("{% capture email_title %}The last item in your order is on the way{% endcapture %}", "{% capture email_title %}آخر منتج في طلبك في الطريق إليك{% endcapture %}"),
    ("{% capture hero_1 %}The last item{% endcapture %}{% capture hero_2 %}is on the way.{% endcapture %}", "{% capture hero_1 %}آخر منتج{% endcapture %}{% capture hero_2 %}في الطريق إليك.{% endcapture %}"),
    ("{% capture email_body %}The last item in your order is on the way. Track your shipment to see the delivery status.{% endcapture %}", "{% capture email_body %}آخر منتج في طلبك في الطريق إليك. تتبّع شحنتك لمعرفة حالة التوصيل.{% endcapture %}"),
    ("{% capture email_title %}One item in your order is on the way{% endcapture %}", "{% capture email_title %}منتج من طلبك في الطريق إليك{% endcapture %}"),
    ("{% capture hero_1 %}One item{% endcapture %}{% capture hero_2 %}is on the way.{% endcapture %}", "{% capture hero_1 %}منتج واحد{% endcapture %}{% capture hero_2 %}في الطريق إليك.{% endcapture %}"),
    ("{% capture email_body %}One item in your order is on the way. Track your shipment to see the delivery status.{% endcapture %}", "{% capture email_body %}منتج من طلبك في الطريق إليك. تتبّع شحنتك لمعرفة حالة التوصيل.{% endcapture %}"),
    ("&mdash; order {{ order_name }}{% if fulfillment.estimated_delivery_at %}, arriving ", "&mdash; الطلب {{ order_name }}{% if fulfillment.estimated_delivery_at %}، يصل في "),
    ("Order&nbsp;<span", "طلب&nbsp;<span"),
    ("PO number {{ lo }}", "رقم أمر الشراء {{ lo }}"),
    ("&#9679;&nbsp;Shipped", "&#9679;&nbsp;تم الشحن"),
    ("{% if customer.first_name != blank %}Hi {{ bo }}", "{% if customer.first_name != blank %}مرحباً {{ bo }}"),
    (">Ordered<", ">تم الطلب<"),
    (">Packed<", ">تم التغليف<"),
    (">Shipped</div>", ">تم الشحن</div>"),
    (">Delivered<", ">تم التوصيل<"),
    (">Estimated delivery<", ">موعد التوصيل المتوقع<"),
    ("Tracking number{% else %}Tracking numbers", "رقم التتبع{% else %}أرقام التتبع"),
    ("Track your package&nbsp;&rarr;", "تتبّع شحنتك&nbsp;&larr;"),
    ("View your order&nbsp;&rarr;", "عرض طلبك&nbsp;&larr;"),
    ("Track order with{% else %}Download to track with{% endif %}", "تتبّع الطلب عبر{% else %}حمّل التطبيق للتتبّع عبر{% endif %}"),
    (">View your order</a>", ">عرض طلبك</a>"),
    ("{% elsif shop.url %}or {% endif %}", "{% elsif shop.url %}أو {% endif %}"),
    (">Visit our store</a>", ">زُر متجرنا</a>"),
    (">In the box<", ">داخل الصندوق<"),
    (">Items in this shipment<", ">المنتجات في هذه الشحنة<"),
    ("{% if shipped_units == 1 %}item{% else %}items{% endif %}", "قطعة"),
    ("{% if group.deliverable? %}For: {% else %}Part of: {% endif %}", "{% if group.deliverable? %}لـ: {% else %}جزء من: {% endif %}"),
    (">Refunded<", ">مسترد<"),
    ("> of {{ lo }}", "> من {{ lo }}"),
    (">Shipping to<", ">الشحن إلى<"),
    (">Shipping method<", ">طريقة الشحن<"),
    (">Questions?<", ">عندك سؤال؟<"),
    ("Reply to this email or message us on WhatsApp — we’re quick.", "رد على هذه الرسالة أو راسلنا على واتساب — نرد بسرعة."),
    (">WhatsApp us<", ">راسلنا على واتساب<"),
    ("'Hi 89, about my order '", "'مرحباً 89، بخصوص طلبي '"),
    (">Shop</a>", ">المتجر</a>"),
    (">Instagram</a>", ">إنستغرام</a>"),
    (">WhatsApp</a>", ">واتساب</a>"),
    ("If you have any questions, reply to this email or contact us at", "إذا كان لديك أي استفسار، رد على هذه الرسالة أو تواصل معنا على"),
    ('<div class="x-wordmark" style="', '<div class="x-wordmark" dir="ltr" style="text-align:right;'),
    ("font-size:52px;line-height:50px", "font-size:48px;line-height:66px"),
    (".x-hero { font-size: 40px !important; line-height: 40px !important; }", ".x-hero { font-size: 38px !important; line-height: 54px !important; }"),
    (".x-wordmark { font-size: 34px !important; line-height: 34px !important; }", ".x-wordmark { font-size: 34px !important; line-height: 44px !important; }"),
    ("font-size:26px;line-height:28px", "font-size:26px;line-height:38px"),
    ("font-size:46px;line-height:44px", "font-size:46px;line-height:56px"),
]

def ar_letterspacing(s):
    return re.sub(r"letter-spacing:\s*-?[\d.]+(px|em)", "letter-spacing:0", s)

# ---------------------------------------------------------------- packing slip
PS = [
    ('<div class="slip">', '<div class="slip" dir="rtl" lang="ar">'),
    ("  assign collect_on_delivery = false\n",
     "  case order.financial_status\n    when 'paid'\n      assign status_ar = 'مدفوع'\n    when 'pending'\n      assign status_ar = 'بانتظار الدفع'\n    when 'authorized'\n      assign status_ar = 'مُصرّح'\n    when 'partially_paid'\n      assign status_ar = 'مدفوع جزئياً'\n    when 'refunded'\n      assign status_ar = 'مسترد'\n    when 'partially_refunded'\n      assign status_ar = 'مسترد جزئياً'\n    when 'voided'\n      assign status_ar = 'ملغى'\n    else\n      assign status_ar = order.financial_status\n  endcase\n  assign collect_on_delivery = false\n"),
    ('<p class="eyebrow eyebrow--red">Packing slip</p>', '<p class="eyebrow eyebrow--red">قائمة التعبئة</p>'),
    ("Your fit is here<span", "إطلالتك وصلت<span"),
    ("PO #{{ order.po_number }}", "أمر شراء #{{ order.po_number }}"),
    (">Items in this box<", ">القطع في الصندوق<"),
    ("{{ line_count }} product{% if line_count != 1 %}s{% endif %}", "{{ line_count }} منتج"),
    ('<p class="stat__label">Shipment</p>', '<p class="stat__label">الشحنة</p>'),
    ("Complete{% else %}Partial", "مكتملة{% else %}جزئية"),
    ("{{ units_in_box }} of {{ units_in_order }} units", "{{ units_in_box }} من {{ units_in_order }} قطعة"),
    ('<p class="stat__label">Delivery</p>', '<p class="stat__label">التوصيل</p>'),
    ("-%}Pickup\n", "-%}استلام من المتجر\n"),
    ("-%}Local delivery\n", "-%}توصيل محلي\n"),
    ("-%}No shipping\n", "-%}بدون شحن\n"),
    ("-%}Shipping\n", "-%}شحن\n"),
    ("Has instructions{% else %}Standard", "يوجد تعليمات{% else %}عادي"),
    (">Order total<", ">إجمالي الطلب<"),
    ("Saved {{ order.total_discounts | money }}{% else %}{{ order.financial_status | replace: '_', ' ' | capitalize }}", "وفّرت {{ order.total_discounts | money }}{% else %}{{ status_ar }}"),
    (">Box value<", ">قيمة الصندوق<"),
    ("Saved {{ box_saved | money }}{% else %}This shipment", "وفّرت {{ box_saved | money }}{% else %}هذه الشحنة"),
    (">Packed on<", ">تاريخ التعبئة<"),
    ("{{ 'now' | date: \"%b %d\" }}", "{{ 'now' | date: \"%d/%m\" }}"),
    (">Collect on delivery<", ">التحصيل عند التوصيل<"),
    ("Payment is {{ order.financial_status | replace: '_', ' ' }} &mdash; please collect from the customer.", "حالة الدفع: {{ status_ar }} &mdash; يرجى تحصيل المبلغ من العميل."),
    ("Deliver to{% else %}Ship to", "التوصيل إلى{% else %}الشحن إلى"),
    ("No shipping address", "لا يوجد عنوان شحن"),
    (">Bill to<", ">الفوترة إلى<"),
    ("No billing address", "لا يوجد عنوان فوترة"),
    ('eyebrow--c">Customer<', 'eyebrow--c">العميل<'),
    (">Store pickup<", ">استلام من المتجر<"),
    (">In the box<", ">داخل الصندوق<"),
    ("item{% if units_in_box != 1 %}s{% endif %}", "قطعة"),
    ('<th colspan="2">Item</th>', '<th colspan="2">المنتج</th>'),
    ('<th class="num">Price</th>', '<th class="num">السعر</th>'),
    ('<th class="num">Qty</th>', '<th class="num">الكمية</th>'),
    ('<th class="num">Total</th>', '<th class="num">الإجمالي</th>'),
    (">SKU {{ line_item.sku }}", ">رمز <span dir=\"ltr\">{{ line_item.sku }}</span>"),
    (">Add-on</span> for", ">إضافة</span> لـ"),
    (">Bundle</span> part of", ">باقة</span> ضمن"),
    ('">Free</span>', '">مجاني</span>'),
    ("<strong>Heads up:</strong> other items from your order are coming in a separate shipment.", "<strong>تنبيه:</strong> باقي منتجات طلبك ستصلك في شحنة منفصلة."),
    (">You saved<", ">وفّرت<"),
    ("<td>This box</td>", "<td>هذا الصندوق</td>"),
    ("<td>Subtotal</td>", "<td>المجموع الفرعي</td>"),
    ("<td>Discounts</td>", "<td>الخصومات</td>"),
    ("{% if is_pickup %}Pickup{% else %}Shipping{% endif %}", "{% if is_pickup %}الاستلام{% else %}الشحن{% endif %}"),
    ("<td>Duties</td>", "<td>الرسوم الجمركية</td>"),
    ("<td>Taxes</td>", "<td>الضرائب</td>"),
    ("<td>Total</td>", "<td>الإجمالي</td>"),
    ("&#10003; Paid", "&#10003; مدفوع"),
    ("{{ order.financial_status | replace: '_', ' ' | capitalize }}</span>", "{{ status_ar }}</span>"),
    ("<td>Box total</td>", "<td>إجمالي الصندوق</td>"),
    (">Order note<", ">ملاحظة الطلب<"),
    (">Delivery instructions<", ">تعليمات التوصيل<"),
    ("</span> Picked</span>", "</span> تم التجميع</span>"),
    ("</span> Quality checked</span>", "</span> تم فحص الجودة</span>"),
    ("</span> Packed</span>", "</span> تم التغليف</span>"),
    ("Packed by <i>", "غلّفه <i>"),
    (">From the 89 crew<", ">من فريق 89<"),
    ("Thank you{% if customer.first_name != blank %}, {{ customer.first_name }}{% endif %}!", "شكراً لك{% if customer.first_name != blank %}، {{ customer.first_name }}{% endif %}!"),
    ("Wear it loud. Tag us <strong>{{ brand_instagram }}</strong> on Instagram &mdash; we repost our favourite fits.", "البسها بثقة! أشِر إلينا <strong dir=\"ltr\">{{ brand_instagram }}</strong> على إنستغرام &mdash; ننشر أجمل الإطلالات."),
    ("Wrong size or something off? Message us and we&rsquo;ll sort it out fast.", "المقاس غير مناسب أو في مشكلة؟ راسلنا ونحلّها لك بسرعة."),
    ("Scan to chat<br><strong>", "امسح للمحادثة<br><strong dir=\"ltr\">"),
    ("font-family: 'Kanit', 'Cairo',", "font-family: 'Cairo', 'Kanit',"),
    ('<span class="phone">&#9742; {{ shipping_address.phone }}</span>', '<span class="phone">&#9742; <span dir="ltr">{{ shipping_address.phone }}</span></span>'),
    ('<p class="foot__word">', '<p class="foot__word" dir="ltr">'),
    ("{% if customer.first_name != blank %}، {{ customer.first_name }}{% endif %}", "{% if customer.first_name != blank %}، <bdi>{{ customer.first_name }}</bdi>{% endif %}"),
    ("</style>", """
  /* ---- Arabic / RTL adjustments ---- */
  .slip * { letter-spacing: 0 !important; }
  .slip { line-height: 1.6; }
  .hdr__title, .thanks__title, .section-head__title { line-height: 1.3; }
  .hdr__meta, .foot__info { text-align: left; }
  .items th { text-align: right; }
  .items .num, .totals .num { text-align: left; }
  .notice, .sticky { border-left: 0; border-right: 5px solid var(--c); }
  .sticky { border-radius: 14px 4px 14px 14px; }
  .check__sign { margin-left: 0; margin-right: auto; }
  .thanks::before { left: auto; right: 0; }
  .totals .num { direction: ltr; unicode-bidi: isolate; }
  .hdr__order, .cod__amount, .stat__value, .now, .was, .qty, .totals__grand .num { direction: ltr; unicode-bidi: isolate; }
</style>"""),
]

for src_name, out_name, pairs in [("order-confirmation.liquid", "order-confirmation.ar.liquid", OC),
                                   ("packing-slip.liquid", "packing-slip.ar.liquid", PS),
                                   ("shipping-confirmation.liquid", "shipping-confirmation.ar.liquid", SHIP)]:
    s = (ROOT / src_name).read_text()
    s = apply(s, pairs, src_name)
    s = ar_letterspacing(s)
    s = ("{%- comment -%}\n  ARABIC VERSION — generated by tools/make_arabic.py from " + src_name + ".\n"
         "  Paste into: Translate & Adapt > Arabic > Notifications > (this template) > Arabic field.\n"
         "  Do NOT use Auto-translate on this template; it would translate the Liquid code.\n{%- endcomment -%}\n") + s
    (ROOT / out_name).write_text(s)
    print("wrote", out_name, len(s))

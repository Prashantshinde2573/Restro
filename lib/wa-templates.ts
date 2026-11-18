// Ready-made WhatsApp messages for common situations, in English, Marathi and Hindi.
// {name} = the guest's first name, {place} = the restaurant's name. Words in [brackets] are for the
// owner to fill in before sending.

export type TemplateLang = "en" | "mr" | "hi";
export type Template = { id: string; emoji: string; label: string; text: Record<TemplateLang, string> };

export const TEMPLATES: Template[] = [
  {
    id: "thanks",
    emoji: "🙏",
    label: "Thank you",
    text: {
      en: "Hi {name}! Thank you for visiting {place}. It was lovely having you — see you again soon 🙏",
      mr: "नमस्कार {name}! {place} ला भेट दिल्याबद्दल धन्यवाद. तुम्ही आलात खूप छान वाटलं — लवकरच पुन्हा या 🙏",
      hi: "नमस्ते {name}! {place} आने के लिए धन्यवाद। आपका आना बहुत अच्छा लगा — जल्दी फिर मिलते हैं 🙏",
    },
  },
  {
    id: "miss",
    emoji: "💛",
    label: "We miss you",
    text: {
      en: "Hi {name}, it's been a while! We miss you at {place}. Drop by this week — your favourite is waiting 😊",
      mr: "नमस्कार {name}, बरेच दिवस झाले! {place} ला तुमची आठवण येते. या आठवड्यात नक्की या — तुमची आवडती डिश वाट पाहतेय 😊",
      hi: "नमस्ते {name}, काफ़ी दिन हो गए! {place} में आपकी याद आती है। इस हफ़्ते ज़रूर आइए — आपकी पसंदीदा डिश इंतज़ार कर रही है 😊",
    },
  },
  {
    id: "weekend",
    emoji: "🎉",
    label: "Weekend offer",
    text: {
      en: "Hi {name}! This weekend at {place}: [10% off on the full bill]. Bring your family and friends 🎉",
      mr: "नमस्कार {name}! या वीकेंडला {place} मध्ये: [संपूर्ण बिलावर 10% सूट]. कुटुंब आणि मित्रांसोबत नक्की या 🎉",
      hi: "नमस्ते {name}! इस वीकेंड {place} पर: [पूरे बिल पर 10% छूट]। परिवार और दोस्तों के साथ ज़रूर आइए 🎉",
    },
  },
  {
    id: "new-dish",
    emoji: "🍽️",
    label: "New on the menu",
    text: {
      en: "Hi {name}! Something new at {place}: [dish name]. Come taste it first and tell us how you like it 🍽️",
      mr: "नमस्कार {name}! {place} मध्ये नवीन: [डिशचं नाव]. सर्वात आधी चव घ्यायला या आणि कशी वाटली ते सांगा 🍽️",
      hi: "नमस्ते {name}! {place} में कुछ नया: [डिश का नाम]। सबसे पहले चखने आइए और बताइए कैसा लगा 🍽️",
    },
  },
  {
    id: "festival",
    emoji: "🪔",
    label: "Festival wishes",
    text: {
      en: "Happy [Diwali], {name}! 🪔 Wishing you and your family joy and good food. Celebrate with us at {place} — [special festive menu].",
      mr: "{name}, [दिवाळीच्या] हार्दिक शुभेच्छा! 🪔 तुम्हाला आणि कुटुंबाला आनंद आणि भरपूर चविष्ट जेवण लाभो. {place} मध्ये आमच्यासोबत साजरा करा — [खास सणाचा मेनू].",
      hi: "{name}, [दिवाली] की हार्दिक शुभकामनाएँ! 🪔 आपको और आपके परिवार को ख़ुशियाँ और अच्छा खाना मिले। {place} में हमारे साथ मनाइए — [ख़ास त्योहार मेनू]।",
    },
  },
  {
    id: "happy-hours",
    emoji: "⏰",
    label: "Happy hours",
    text: {
      en: "Hi {name}! Happy hours at {place}, [4–7 pm]: [buy 1 get 1 on drinks]. See you this evening ⏰",
      mr: "नमस्कार {name}! {place} मध्ये हॅपी अवर्स, [दुपारी 4–7]: [ड्रिंक्सवर 1 वर 1 फ्री]. आज संध्याकाळी भेटू ⏰",
      hi: "नमस्ते {name}! {place} में हैप्पी आवर्स, [शाम 4–7]: [ड्रिंक्स पर 1 पर 1 फ्री]। आज शाम मिलते हैं ⏰",
    },
  },
  {
    id: "birthday",
    emoji: "🎂",
    label: "Birthday",
    text: {
      en: "Happy birthday, {name}! 🎂 Celebrate at {place} this week and get [a free dessert] on us.",
      mr: "वाढदिवसाच्या हार्दिक शुभेच्छा, {name}! 🎂 या आठवड्यात {place} मध्ये साजरा करा आणि [एक डेझर्ट मोफत] मिळवा.",
      hi: "जन्मदिन मुबारक हो, {name}! 🎂 इस हफ़्ते {place} में मनाइए और पाइए [एक डेज़र्ट मुफ़्त]।",
    },
  },
  {
    id: "stamps",
    emoji: "🎁",
    label: "Stamp card",
    text: {
      en: "Hi {name}! You're close to a free treat at {place} 🎁 Every bill gets a stamp — fill your card and the reward is yours.",
      mr: "नमस्कार {name}! {place} मध्ये तुमचं मोफत बक्षीस जवळ आलंय 🎁 प्रत्येक बिलावर एक स्टॅम्प — कार्ड भरा आणि बक्षीस तुमचं.",
      hi: "नमस्ते {name}! {place} में आपका मुफ़्त इनाम बस करीब है 🎁 हर बिल पर एक स्टैम्प — कार्ड भरिए और इनाम आपका।",
    },
  },
  {
    id: "feedback",
    emoji: "⭐",
    label: "Ask for a review",
    text: {
      en: "Hi {name}, thank you for coming to {place}! How was everything? A quick review would mean a lot to us ⭐ [review link]",
      mr: "नमस्कार {name}, {place} ला आल्याबद्दल धन्यवाद! सगळं कसं वाटलं? एक छोटा रिव्ह्यू दिलात तर आम्हाला खूप मदत होईल ⭐ [रिव्ह्यू लिंक]",
      hi: "नमस्ते {name}, {place} आने के लिए धन्यवाद! सब कैसा लगा? एक छोटा सा रिव्यू हमारे लिए बहुत मायने रखेगा ⭐ [रिव्यू लिंक]",
    },
  },
  {
    id: "event",
    emoji: "🎶",
    label: "Special event",
    text: {
      en: "Hi {name}! Join us at {place} on [Saturday, 8 pm] for [live music night] 🎶 Call us to book your table.",
      mr: "नमस्कार {name}! [शनिवार, रात्री 8] ला {place} मध्ये [लाइव्ह म्युझिक नाईट] 🎶 टेबल बुक करण्यासाठी फोन करा.",
      hi: "नमस्ते {name}! [शनिवार, रात 8 बजे] {place} में [लाइव म्यूज़िक नाइट] 🎶 टेबल बुक करने के लिए फ़ोन करें।",
    },
  },
  {
    id: "closed",
    emoji: "📢",
    label: "Closed / timing change",
    text: {
      en: "Hi {name}, a quick note from {place}: we'll be [closed on Monday, 18 Nov]. We're back [Tuesday] as usual. Thank you! 📢",
      mr: "नमस्कार {name}, {place} कडून एक सूचना: [सोमवार, 18 नोव्हेंबरला] आम्ही बंद राहू. [मंगळवारपासून] नेहमीप्रमाणे सुरू. धन्यवाद! 📢",
      hi: "नमस्ते {name}, {place} की ओर से सूचना: [सोमवार, 18 नवंबर को] हम बंद रहेंगे। [मंगलवार से] हमेशा की तरह खुले हैं। धन्यवाद! 📢",
    },
  },
];

export const fillTemplate = (t: Template, lang: TemplateLang, place: string) => t.text[lang].replaceAll("{place}", place || "us");

/* ---------------- coupon offer block ---------------- */
// WhatsApp click-to-chat carries text only, so the offer is laid out with WhatsApp's own
// *bold* and emoji: what it is, the code, until when, on what bill, and how to use it.
type OfferCoupon = { code: string; kind: "percent" | "flat"; value: number; maxOff?: number; minBill?: number; validTo?: string };
const OFFER_RULE = "━━━━━━━━━━━━━━";
const offerDate = (ymd: string) => {
  const d = new Date(ymd + "T00:00:00Z");
  const sameYear = d.getUTCFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
};

export function offerBlock(c: OfferCoupon, lang: TemplateLang, place: string) {
  const name = place || (lang === "mr" ? "आमच्याकडे" : lang === "hi" ? "हमारे यहाँ" : "Our café");
  const off =
    c.kind === "percent"
      ? { en: `*${c.value}% OFF*${c.maxOff ? ` (up to ₹${c.maxOff})` : ""}`, mr: `*${c.value}% सूट*${c.maxOff ? ` (₹${c.maxOff} पर्यंत)` : ""}`, hi: `*${c.value}% छूट*${c.maxOff ? ` (₹${c.maxOff} तक)` : ""}` }[lang]
      : { en: `*₹${c.value} OFF*`, mr: `*₹${c.value} सूट*`, hi: `*₹${c.value} छूट*` }[lang];
  const till = c.validTo ? { en: `Valid till ${offerDate(c.validTo)}`, mr: `${offerDate(c.validTo)} पर्यंत`, hi: `${offerDate(c.validTo)} तक` }[lang] : "";
  const min = c.minBill ? { en: `on bills of ₹${c.minBill}+`, mr: `₹${c.minBill}+ बिलावर`, hi: `₹${c.minBill}+ के बिल पर` }[lang] : "";
  const when = [till, min].filter(Boolean).join(" · ");
  const lines = {
    en: [`🎉 *${name} – Special offer!*`, OFFER_RULE, `🎁 ${off}`, `🔖 Code: *${c.code}*`, when ? `📅 ${when[0].toUpperCase()}${when.slice(1)}` : null, "", "*How to use:*", `Scan the QR on your table → when you pay, tap "Have a coupon code?" → enter *${c.code}* ✅`, "Or just show this message at the counter."],
    mr: [`🎉 *${name} – खास ऑफर!*`, OFFER_RULE, `🎁 ${off}`, `🔖 कोड: *${c.code}*`, when ? `📅 ${when}` : null, "", "*कसा वापरायचा:*", `टेबलवरचा QR स्कॅन करा → पैसे भरताना "Have a coupon code?" वर दाबा → *${c.code}* टाका ✅`, "किंवा हा मेसेज काउंटरवर दाखवा."],
    hi: [`🎉 *${name} – खास ऑफ़र!*`, OFFER_RULE, `🎁 ${off}`, `🔖 कोड: *${c.code}*`, when ? `📅 ${when}` : null, "", "*कैसे इस्तेमाल करें:*", `टेबल पर QR स्कैन करें → पेमेंट करते समय "Have a coupon code?" दबाएँ → *${c.code}* डालें ✅`, "या यह मैसेज काउंटर पर दिखाएँ।"],
  }[lang];
  return lines.filter((l): l is string => typeof l === "string").join("\n");
}

/** Put the offer under the message, replacing an offer block added before (one offer per message). */
export function withOffer(msg: string, block: string) {
  const at = msg.indexOf("\n\n🎉 *");
  const base = (at >= 0 && msg.includes(OFFER_RULE, at) ? msg.slice(0, at) : msg.startsWith("🎉 *") && msg.includes(OFFER_RULE) ? "" : msg).trimEnd();
  // drop the old one-line offer ("🎁 10% off with code *X*") if it is still there
  const clean = base.replace(/\n*🎁 [^\n]* with code \*[A-Z0-9]+\*\s*$/u, "").trimEnd();
  return clean ? `${clean}\n\n${block}` : block;
}

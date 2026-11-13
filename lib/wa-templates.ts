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

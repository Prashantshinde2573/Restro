// "What's new": short notes on new features and changes, newest first, in English, Marathi and Hindi.
// Add an entry at the top whenever something new ships (a new id makes the dot show on the tab).
import type { Lang } from "./i18n";

type T = Record<Lang, string>;
export type WhatsNew = {
  id: string; // unique, newest first
  date: string; // YYYY-MM-DD
  tag: "new" | "better" | "fixed";
  title: T;
  points: Record<Lang, string[]>;
  href?: string; // the screen it is on
};

export const WHATS_NEW: WhatsNew[] = [
  {
    id: "2026-11-26-language",
    date: "2026-11-26",
    tag: "new",
    title: { en: "The whole app in Marathi and Hindi", mr: "संपूर्ण ॲप मराठी आणि हिंदीत", hi: "पूरा ऐप मराठी और हिंदी में" },
    points: {
      en: ["Pick मराठी or हिंदी at the bottom of More (on a computer, in your profile menu): every button, heading and message follows it, not only the tabs.", "Dish names, staff names and amounts stay as you typed them.", "Excel, CSV and PDF reports stay in English for your CA."],
      mr: ["“अधिक” च्या खाली (कॉम्प्युटरवर प्रोफाइल मेनूमध्ये) मराठी किंवा हिंदी निवडा: फक्त टॅब नाही, प्रत्येक बटण, हेडिंग आणि मेसेज त्या भाषेत.", "डिशची नावं, स्टाफची नावं आणि रक्कम तुम्ही लिहिली तशीच राहतात.", "Excel, CSV आणि PDF रिपोर्ट तुमच्या CA साठी इंग्रजीतच राहतात."],
      hi: ["“और” के नीचे (कंप्यूटर पर प्रोफ़ाइल मेन्यू में) मराठी या हिंदी चुनें: सिर्फ़ टैब नहीं, हर बटन, हेडिंग और मैसेज उसी भाषा में।", "डिश के नाम, स्टाफ के नाम और रक़म जैसे लिखे वैसे ही रहते हैं।", "Excel, CSV और PDF रिपोर्ट आपके CA के लिए अंग्रेज़ी में ही रहती हैं।"],
    },
  },
  {
    id: "2026-11-25-call-for-bill",
    date: "2026-11-25",
    tag: "new",
    title: { en: "Guests can “Call for bill”", mr: "ग्राहक “बिल मागवा” दाबू शकतात", hi: "ग्राहक “बिल मँगाएँ” दबा सकते हैं" },
    points: {
      en: ["Without an online gateway, guests see your UPI QR with “Download QR & pay”, then “I've paid”.", "“Call for bill” tells you, your waiters and whoever takes payments which table wants the bill.", "Take the QR to the table or let them pay at the counter, then mark the bill paid as usual."],
      mr: ["ऑनलाइन गेटवे नसेल तर ग्राहकांना तुमचा UPI QR, “Download QR & pay” आणि मग “I've paid” दिसतं.", "“बिल मागवा” दाबलं की तुम्हाला, वेटरना आणि पैसे घेणाऱ्यांना कोणतं टेबल बिल मागतंय ते कळतं.", "QR टेबलवर न्या किंवा काउंटरवर पैसे घ्या, मग नेहमीसारखं बिल भरलं करा."],
      hi: ["ऑनलाइन गेटवे न हो तो ग्राहकों को आपका UPI QR, “Download QR & pay” और फिर “I've paid” दिखता है।", "“बिल मँगाएँ” दबाने पर आपको, वेटरों को और भुगतान लेने वालों को पता चलता है कि कौन सी टेबल बिल माँग रही है।", "QR टेबल पर ले जाएँ या काउंटर पर भुगतान लें, फिर हमेशा की तरह बिल भुगतान करें।"],
    },
    href: "/app/tables",
  },
  {
    id: "2026-11-25-qr-print",
    date: "2026-11-25",
    tag: "better",
    title: { en: "Table QR cards print at 4 × 6 inch", mr: "टेबल QR कार्ड 4 × 6 इंचात प्रिंट", hi: "टेबल QR कार्ड 4 × 6 इंच में प्रिंट" },
    points: {
      en: ["One card per page, 4 inch wide and 6 inch tall, with a bigger QR.", "Choose 4×6 (photo) paper and 100% scale when printing."],
      mr: ["एका पानावर एक कार्ड, 4 इंच रुंद आणि 6 इंच उंच, मोठा QR.", "प्रिंट करताना 4×6 (फोटो) पेपर आणि 100% स्केल निवडा."],
      hi: ["एक पेज पर एक कार्ड, 4 इंच चौड़ा और 6 इंच लंबा, बड़ा QR।", "प्रिंट करते समय 4×6 (फ़ोटो) पेपर और 100% स्केल चुनें।"],
    },
    href: "/print/tables",
  },
  {
    id: "2026-11-25-alerts",
    date: "2026-11-25",
    tag: "fixed",
    title: { en: "No repeat notifications after signing in", mr: "लॉगिननंतर जुन्या सूचना परत येत नाहीत", hi: "लॉगिन के बाद पुरानी सूचनाएँ दोबारा नहीं आतीं" },
    points: {
      en: ["Opening the app on another phone no longer rings yesterday's orders again.", "Only things from the last 15 minutes ring as new."],
      mr: ["दुसऱ्या फोनवर ॲप उघडलं तरी कालच्या ऑर्डरच्या सूचना परत येत नाहीत.", "फक्त मागच्या 15 मिनिटांतल्या गोष्टी नवीन म्हणून वाजतात."],
      hi: ["दूसरे फ़ोन पर ऐप खोलने पर कल के ऑर्डर की सूचनाएँ दोबारा नहीं आतीं।", "सिर्फ़ पिछले 15 मिनट की चीज़ें नई के रूप में बजती हैं।"],
    },
  },
  {
    id: "2026-11-24-clean-table",
    date: "2026-11-24",
    tag: "new",
    title: { en: "Clean table: assign and get notified", mr: "टेबल साफ करा: सोपवा आणि सूचना मिळवा", hi: "टेबल साफ़ करें: सौंपें और सूचना पाएँ" },
    points: {
      en: ["After guests pay and leave, the table shows “To clean”.", "Tap “Clean table” (next to “Join a table”) to send anyone free or one person; they get a notification.", "They tap “Cleaned” when done."],
      mr: ["ग्राहक पैसे देऊन गेले की टेबलवर “साफ करायचं” दिसतं.", "“टेबल साफ करा” (“टेबल जोडा” च्या बाजूला) दाबून जो मोकळा असेल त्याला किंवा एका व्यक्तीला पाठवा; त्यांना सूचना जाते.", "काम झालं की ते “साफ केलं” दाबतात."],
      hi: ["ग्राहक भुगतान करके चले जाएँ तो टेबल पर “साफ़ करना है” दिखता है।", "“टेबल साफ़ करें” (“टेबल जोड़ें” के पास) दबाकर जो खाली हो उसे या एक व्यक्ति को भेजें; उन्हें सूचना जाती है।", "काम होने पर वे “साफ़ हुआ” दबाते हैं।"],
    },
    href: "/app/tables",
  },
  {
    id: "2026-11-24-online-pay",
    date: "2026-11-24",
    tag: "better",
    title: { en: "Online payments finish even if the phone reloads", mr: "फोन रीलोड झाला तरी ऑनलाइन पेमेंट पूर्ण होतं", hi: "फ़ोन रीलोड हो तब भी ऑनलाइन भुगतान पूरा होता है" },
    points: {
      en: ["If a guest's browser reloads while they are in the UPI app, the bill still closes once the money is in.", "A guest is never charged twice for the same bill."],
      mr: ["ग्राहक UPI ॲपमध्ये असताना ब्राउझर रीलोड झाला तरी पैसे आले की बिल बंद होतं.", "एकाच बिलासाठी ग्राहकाकडून दोनदा पैसे घेतले जात नाहीत."],
      hi: ["ग्राहक UPI ऐप में हों और ब्राउज़र रीलोड हो जाए, तब भी पैसे आते ही बिल बंद होता है।", "एक ही बिल के लिए ग्राहक से दो बार पैसे नहीं लिए जाते।"],
    },
  },
  {
    id: "2026-11-23-guest-cancel",
    date: "2026-11-23",
    tag: "new",
    title: { en: "Guests can cancel before the kitchen starts", mr: "किचन सुरू होण्याआधी ग्राहक ऑर्डर रद्द करू शकतात", hi: "किचन शुरू होने से पहले ग्राहक ऑर्डर रद्द कर सकते हैं" },
    points: {
      en: ["A QR order can be cancelled from the guest's phone until the kitchen starts cooking it.", "A table with only cancelled orders goes back to “Seated”, and you can free it."],
      mr: ["किचनने शिजवायला सुरू करेपर्यंत ग्राहक त्याच्या फोनवरून QR ऑर्डर रद्द करू शकतो.", "फक्त रद्द ऑर्डर असलेलं टेबल परत “बसले” होतं, आणि तुम्ही ते मोकळं करू शकता."],
      hi: ["किचन के बनाना शुरू करने तक ग्राहक अपने फ़ोन से QR ऑर्डर रद्द कर सकते हैं।", "सिर्फ़ रद्द ऑर्डर वाली टेबल फिर “बैठे” हो जाती है, और आप उसे खाली कर सकते हैं।"],
    },
    href: "/app/orders",
  },
  {
    id: "2026-11-23-two-step",
    date: "2026-11-23",
    tag: "new",
    title: { en: "Two-step login with Google Authenticator", mr: "Google Authenticator सह two-step login", hi: "Google Authenticator के साथ two-step login" },
    points: {
      en: ["Owners can turn it on in their profile for extra safety: a code from your phone at every new sign-in.", "Lost the phone? Restropi support can reset it."],
      mr: ["जास्त सुरक्षिततेसाठी मालक प्रोफाइलमध्ये हे चालू करू शकतात: प्रत्येक नवीन लॉगिनला फोनवरचा कोड.", "फोन हरवला? Restropi सपोर्ट रीसेट करू शकतो."],
      hi: ["ज़्यादा सुरक्षा के लिए मालिक प्रोफ़ाइल में इसे चालू कर सकते हैं: हर नए लॉगिन पर फ़ोन से कोड।", "फ़ोन खो गया? Restropi सपोर्ट रीसेट कर सकता है।"],
    },
  },
];

export const LATEST_WHATS_NEW = WHATS_NEW[0]?.id ?? "";
const SEEN_KEY = "restropi.whatsnew.seen";
export function whatsNewSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}
export function markWhatsNewSeen() {
  try {
    localStorage.setItem(SEEN_KEY, LATEST_WHATS_NEW);
  } catch {}
}

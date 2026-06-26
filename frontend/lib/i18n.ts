import type { Language } from "@/types";

type Dict = Record<string, { en: string; ar: string }>;

export const dict: Dict = {
  appName: { en: "Shifa Health", ar: "شفاء الصحية" },
  appTagline: { en: "AI Voice Care Platform", ar: "منصة الرعاية الصوتية بالذكاء الاصطناعي" },

  // Nav
  nav_home: { en: "Home", ar: "الرئيسية" },
  nav_appointment: { en: "Book Appointment", ar: "حجز موعد" },
  nav_doctors: { en: "Doctors", ar: "الأطباء" },
  nav_my_appointments: { en: "My Appointments", ar: "مواعيدي" },

  // My appointments
  appts_title: { en: "My Appointments", ar: "مواعيدي" },
  appts_subtitle: { en: "All your booked appointments.", ar: "جميع مواعيدك المحجوزة." },
  appts_empty: { en: "No appointments yet. Book one from the appointment call.", ar: "لا توجد مواعيد بعد. احجز موعداً من مكالمة الحجز." },
  appts_cancel: { en: "Cancel", ar: "إلغاء" },
  appts_cancelled: { en: "Cancelled", ar: "ملغى" },
  appts_confirmed: { en: "Confirmed", ar: "مؤكد" },
  appts_cancel_confirm: { en: "Cancel this appointment?", ar: "إلغاء هذا الموعد؟" },
  nav_followup: { en: "Follow-Up Call", ar: "مكالمة المتابعة" },
  nav_insights: { en: "Feedback Insights", ar: "تحليلات الملاحظات" },
  nav_demo: { en: "Demo Data", ar: "بيانات العرض" },
  demoBadge: { en: "Demo", ar: "عرض تجريبي" },

  // Home
  home_title: { en: "One AI voice agent for your whole patient journey", ar: "مساعد صوتي واحد بالذكاء الاصطناعي لرحلة المريض كاملة" },
  home_subtitle: {
    en: "Book appointments by voice, get a specialist recommendation, and collect post-visit feedback — in English and Arabic.",
    ar: "احجز المواعيد بصوتك، واحصل على توصية بالطبيب المختص، واجمع ملاحظات ما بعد الزيارة — بالعربية والإنجليزية.",
  },
  home_book_title: { en: "Book an Appointment", ar: "حجز موعد" },
  home_book_desc: { en: "Describe symptoms by voice and book the right specialist.", ar: "صف الأعراض بصوتك واحجز مع الطبيب المناسب." },
  home_followup_title: { en: "Patient Follow-Up Call", ar: "مكالمة متابعة المريض" },
  home_followup_desc: { en: "Run a simulated post-appointment feedback call.", ar: "أجرِ مكالمة محاكاة لجمع الملاحظات بعد الموعد." },
  home_insights_title: { en: "Feedback Insights", ar: "تحليلات الملاحظات" },
  home_insights_desc: { en: "Sentiment, ratings and issue analytics dashboard.", ar: "لوحة تحليلات المشاعر والتقييمات والمشكلات." },
  home_demo_title: { en: "Demo Data Manager", ar: "إدارة بيانات العرض" },
  home_demo_desc: { en: "Reset, seed and load demo scenarios in one click.", ar: "إعادة التعيين والتحميل وتجهيز سيناريوهات العرض بنقرة واحدة." },
  home_open: { en: "Open", ar: "فتح" },

  // Voice / agent
  voice_start: { en: "Start Voice Session", ar: "ابدأ الجلسة الصوتية" },
  voice_start_call: { en: "Start Call", ar: "ابدأ المكالمة" },
  voice_end_call: { en: "End Call", ar: "إنهاء المكالمة" },
  voice_in_call: { en: "In call", ar: "في المكالمة" },
  voice_hold: { en: "Hold mic", ar: "إيقاف المايك" },
  voice_resume: { en: "Resume", ar: "استئناف" },
  voice_on_hold: { en: "Mic on hold — tap to resume, or type below.", ar: "المايك متوقف — اضغط للاستئناف أو اكتب بالأسفل." },
  voice_call_hint: { en: "Speak naturally — the call stays open until you end it.", ar: "تحدث بشكل طبيعي — تبقى المكالمة مفتوحة حتى تنهيها." },
  voice_record: { en: "Hold to talk", ar: "اضغط للتحدث" },
  voice_transcript_after: { en: "Transcript is hidden during the call — shown when it ends.", ar: "النص مخفي أثناء المكالمة — يظهر عند انتهائها." },
  call_ended_title: { en: "Call ended", ar: "انتهت المكالمة" },
  call_ended_sub: { en: "Here's a summary of your conversation.", ar: "إليك ملخص محادثتك." },
  call_transcript: { en: "Call transcript", ar: "نص المكالمة" },
  voice_greeting_hint: { en: "Tell us how you are feeling, and I will help you find the right doctor.", ar: "أخبرنا كيف تشعر، وسأساعدك في إيجاد الطبيب المناسب." },
  voice_tap_to_speak: { en: "Tap to speak", ar: "اضغط للتحدث" },
  voice_listening: { en: "Listening…", ar: "أستمع…" },
  voice_thinking: { en: "Thinking…", ar: "أفكر…" },
  voice_speaking: { en: "Speaking…", ar: "أتحدث…" },
  voice_waiting: { en: "Waiting", ar: "في الانتظار" },
  voice_idle: { en: "Ready", ar: "جاهز" },
  voice_end: { en: "End Session", ar: "إنهاء الجلسة" },
  voice_mute: { en: "Mute voice", ar: "كتم الصوت" },
  voice_unmute: { en: "Unmute voice", ar: "تشغيل الصوت" },
  voice_type_here: { en: "Or type your message…", ar: "أو اكتب رسالتك…" },
  voice_send: { en: "Send", ar: "إرسال" },
  voice_transcript: { en: "Live Transcript", ar: "النص المباشر" },
  voice_replay: { en: "Replay", ar: "إعادة" },
  voice_no_speech: { en: "Voice recognition isn't available in this browser. Please type instead, or use Chrome.", ar: "التعرف على الصوت غير متاح في هذا المتصفح. يرجى الكتابة أو استخدام Chrome." },
  voice_mic_denied: { en: "Microphone access was blocked. Please allow it or type your message.", ar: "تم حظر الوصول إلى الميكروفون. يرجى السماح به أو كتابة رسالتك." },

  // Context panel
  panel_title: { en: "Session Details", ar: "تفاصيل الجلسة" },
  panel_empty: { en: "Doctor recommendations and appointment details will appear here as you talk.", ar: "ستظهر توصيات الأطباء وتفاصيل الموعد هنا أثناء حديثك." },
  panel_suggested_dept: { en: "Suggested Department", ar: "القسم المقترح" },
  panel_recommendation_note: { en: "This is a recommendation to guide you to the right specialist, not a medical diagnosis.", ar: "هذه توصية لإرشادك إلى الطبيب المختص المناسب، وليست تشخيصاً طبياً." },
  panel_doctors: { en: "Available Doctors", ar: "الأطباء المتاحون" },
  panel_slots: { en: "Available Time Slots", ar: "المواعيد المتاحة" },
  panel_booking_summary: { en: "Booking Summary", ar: "ملخص الحجز" },

  // Emergency
  emergency_title: { en: "Urgent care may be needed", ar: "قد تكون هناك حاجة لرعاية عاجلة" },
  emergency_body: { en: "Your symptoms may require urgent medical attention. Please contact local emergency services or visit the nearest emergency department immediately.", ar: "قد تتطلب أعراضك رعاية طبية عاجلة. يرجى الاتصال بخدمات الطوارئ المحلية أو زيارة أقرب قسم طوارئ على الفور." },

  // Doctor card
  doc_experience: { en: "yrs experience", ar: "سنوات خبرة" },
  doc_speaks: { en: "Speaks", ar: "يتحدث" },
  doc_next: { en: "Next available", ar: "أقرب موعد" },
  doc_select: { en: "Select Doctor", ar: "اختيار الطبيب" },
  doc_view: { en: "View availability", ar: "عرض المواعيد" },
  doc_rating: { en: "rating", ar: "تقييم" },

  // Drawer / slots
  drawer_title: { en: "Doctor Availability", ar: "مواعيد الطبيب" },
  drawer_pick_day: { en: "Pick a day", ar: "اختر يوماً" },
  drawer_pick_time: { en: "Pick a time", ar: "اختر وقتاً" },
  drawer_morning: { en: "Morning", ar: "صباحاً" },
  drawer_evening: { en: "Evening", ar: "مساءً" },
  drawer_selected: { en: "Selected slot", ar: "الموعد المختار" },
  drawer_confirm: { en: "Confirm Appointment", ar: "تأكيد الموعد" },
  drawer_none: { en: "No open slots on this day.", ar: "لا توجد مواعيد متاحة في هذا اليوم." },
  nearest_badge: { en: "Nearest available", ar: "أقرب متاح" },
  requested_badge: { en: "Requested", ar: "المطلوب" },

  // Confirmation
  conf_title: { en: "Appointment Confirmed", ar: "تم تأكيد الموعد" },
  conf_subtitle: { en: "A confirmation has been created for your visit.", ar: "تم إنشاء تأكيد لزيارتك." },
  conf_doctor: { en: "Doctor", ar: "الطبيب" },
  conf_dept: { en: "Department", ar: "القسم" },
  conf_datetime: { en: "Date & Time", ar: "التاريخ والوقت" },
  conf_branch: { en: "Branch", ar: "الفرع" },
  conf_ref: { en: "Reference", ar: "الرقم المرجعي" },
  conf_add_calendar: { en: "Add to Calendar", ar: "إضافة إلى التقويم" },
  conf_download: { en: "Download Confirmation", ar: "تنزيل التأكيد" },
  conf_book_another: { en: "Book Another Appointment", ar: "حجز موعد آخر" },

  // Follow-up
  fu_title: { en: "Patient Follow-Up Call", ar: "مكالمة متابعة المريض" },
  fu_subtitle: { en: "Select a completed appointment to start a simulated feedback call.", ar: "اختر موعداً مكتملاً لبدء مكالمة ملاحظات محاكاة." },
  fu_select_patient: { en: "Select a completed appointment", ar: "اختر موعداً مكتملاً" },
  fu_start_call: { en: "Start Follow-Up Call", ar: "بدء مكالمة المتابعة" },
  fu_in_call: { en: "In call", ar: "في المكالمة" },
  fu_question: { en: "Question", ar: "سؤال" },
  fu_of: { en: "of", ar: "من" },
  fu_answer_placeholder: { en: "Speak or type your answer…", ar: "تحدث أو اكتب إجابتك…" },
  fu_end_call: { en: "End Call", ar: "إنهاء المكالمة" },
  fu_analyzing: { en: "Analyzing feedback…", ar: "جارٍ تحليل الملاحظات…" },
  fu_results: { en: "Feedback Analysis", ar: "تحليل الملاحظات" },
  fu_new_call: { en: "Start Another Call", ar: "بدء مكالمة أخرى" },
  fu_no_appts: { en: "No completed appointments. Create one in the Demo Data Manager.", ar: "لا توجد مواعيد مكتملة. أنشئ واحداً من إدارة بيانات العرض." },
  fu_patient: { en: "Patient", ar: "المريض" },
  fu_visited: { en: "Visited", ar: "زار" },

  // Analysis labels
  an_rating: { en: "Overall Rating", ar: "التقييم العام" },
  an_sentiment: { en: "Sentiment", ar: "المشاعر" },
  an_priority: { en: "Follow-up Priority", ar: "أولوية المتابعة" },
  an_positives: { en: "What went well", ar: "ما كان جيداً" },
  an_issues: { en: "Issues raised", ar: "المشكلات المذكورة" },
  an_categories: { en: "Categories", ar: "الفئات" },
  an_summary: { en: "Summary", ar: "الملخص" },
  an_none: { en: "None reported", ar: "لا يوجد" },

  // Insights
  ins_title: { en: "Feedback Insights", ar: "تحليلات الملاحظات" },
  ins_subtitle: { en: "Live analytics from post-appointment feedback calls.", ar: "تحليلات مباشرة من مكالمات ملاحظات ما بعد الموعد." },
  ins_total: { en: "Total Feedback Calls", ar: "إجمالي مكالمات الملاحظات" },
  ins_avg: { en: "Average Rating", ar: "متوسط التقييم" },
  ins_positive: { en: "Positive Sentiment", ar: "المشاعر الإيجابية" },
  ins_negative: { en: "Negative Feedback", ar: "الملاحظات السلبية" },
  ins_top_issue: { en: "Top Issue", ar: "أبرز مشكلة" },
  ins_sentiment_dist: { en: "Sentiment Distribution", ar: "توزيع المشاعر" },
  ins_rating_dist: { en: "Rating Distribution", ar: "توزيع التقييمات" },
  ins_issue_freq: { en: "Issue Categories", ar: "فئات المشكلات" },
  ins_trend: { en: "Feedback Trend", ar: "اتجاه الملاحظات" },
  ins_doctor_rank: { en: "Doctor Satisfaction", ar: "رضا عن الأطباء" },
  ins_recent: { en: "Recent Feedback", ar: "أحدث الملاحظات" },
  ins_expand: { en: "Expand details", ar: "عرض التفاصيل" },
  ins_collapse: { en: "Hide details", ar: "إخفاء التفاصيل" },
  ins_empty: { en: "No feedback yet. Complete a follow-up call to see insights.", ar: "لا توجد ملاحظات بعد. أكمل مكالمة متابعة لرؤية التحليلات." },

  // Demo data
  demo_title: { en: "Demo Data Manager", ar: "إدارة بيانات العرض" },
  demo_subtitle: { en: "Prepare the demo before a presentation.", ar: "جهّز العرض قبل التقديم." },
  demo_status: { en: "Engine Status", ar: "حالة المحرك" },
  demo_ai_on: { en: "AI agent active", ar: "الوكيل الذكي نشط" },
  demo_ai_off: { en: "Rule-based fallback (no API key)", ar: "الوضع الاحتياطي القائم على القواعد (بدون مفتاح)" },
  demo_reset_all: { en: "Reset All Demo Data", ar: "إعادة تعيين كل البيانات" },
  demo_reset_appts: { en: "Reset Appointments", ar: "إعادة تعيين المواعيد" },
  demo_reset_feedback: { en: "Reset Feedback", ar: "إعادة تعيين الملاحظات" },
  demo_seed: { en: "Reseed Doctors & Availability", ar: "إعادة تجهيز الأطباء والمواعيد" },
  demo_create_mock: { en: "Create Mock Completed Appointment", ar: "إنشاء موعد مكتمل تجريبي" },
  demo_lang: { en: "Patient Language", ar: "لغة المريض" },
  demo_scenarios: { en: "Demo Scenarios", ar: "سيناريوهات العرض" },
  demo_load: { en: "Load Scenario", ar: "تحميل السيناريو" },
  demo_actions: { en: "Quick Actions", ar: "إجراءات سريعة" },
  demo_voice: { en: "Voice Engine", ar: "محرك الصوت" },
  demo_voice_test: { en: "Test Voice", ar: "تجربة الصوت" },
  demo_voice_ready: { en: "Neural voice active", ar: "الصوت العصبي نشط" },
  demo_voice_browser: { en: "Browser voice (robotic) — enable a neural provider below", ar: "صوت المتصفح (آلي) — فعّل مزوّد صوت عصبي أدناه" },
  demo_voice_hint: {
    en: "For a real human voice, add a free Gemini key (aistudio.google.com/apikey) to backend/.env as GEMINI_API_KEY, or accept the Groq Orpheus terms. Then restart the backend.",
    ar: "للحصول على صوت بشري حقيقي، أضف مفتاح Gemini مجاني إلى backend/.env باسم GEMINI_API_KEY، أو اقبل شروط Groq Orpheus، ثم أعد تشغيل الخادم.",
  },
  demo_voice_sample: { en: "Hello, I am your hospital assistant. Doctor Hana Aziz has the earliest appointment tomorrow.", ar: "مرحباً، أنا مساعدة حجز المواعيد. الدكتورة هناء عزيز لديها أقرب موعد غداً." },

  // Doctors directory
  doc_dir_title: { en: "Doctors Directory", ar: "دليل الأطباء" },
  doc_dir_subtitle: { en: "View and manage the doctors available for booking.", ar: "اعرض وأدر الأطباء المتاحين للحجز." },
  doc_add: { en: "Add Doctor", ar: "إضافة طبيب" },
  doc_all_depts: { en: "All", ar: "الكل" },
  doc_count: { en: "doctors", ar: "طبيب" },
  doc_bio_label: { en: "About", ar: "نبذة" },
  doc_consultation: { en: "Consultation", ar: "الاستشارة" },
  doc_min: { en: "min", ar: "دقيقة" },
  doc_days_open: { en: "days open", ar: "أيام متاحة" },
  doc_remove: { en: "Remove", ar: "حذف" },
  doc_remove_confirm: { en: "Remove this doctor from the directory?", ar: "حذف هذا الطبيب من الدليل؟" },
  doc_has_appts: { en: "This doctor has appointments. Reset appointments first (Demo Data).", ar: "لدى هذا الطبيب مواعيد. أعد تعيين المواعيد أولاً (بيانات العرض)." },
  doc_empty: { en: "No doctors in this department yet.", ar: "لا يوجد أطباء في هذا القسم بعد." },

  // Add doctor form
  form_title: { en: "Add a New Doctor", ar: "إضافة طبيب جديد" },
  form_name_en: { en: "Name (English)", ar: "الاسم (إنجليزي)" },
  form_name_ar: { en: "Name (Arabic)", ar: "الاسم (عربي)" },
  form_department: { en: "Department", ar: "القسم" },
  form_branch: { en: "Hospital branch", ar: "فرع المستشفى" },
  form_experience: { en: "Years of experience", ar: "سنوات الخبرة" },
  form_languages: { en: "Languages (comma separated)", ar: "اللغات (مفصولة بفواصل)" },
  form_bio: { en: "Short professional bio", ar: "نبذة مهنية مختصرة" },
  form_duration: { en: "Consultation duration (min)", ar: "مدة الاستشارة (دقيقة)" },
  form_rating: { en: "Rating (0–5)", ar: "التقييم (٠–٥)" },
  form_days: { en: "Available days", ar: "أيام التوفر" },
  form_save: { en: "Save Doctor", ar: "حفظ الطبيب" },
  form_cancel: { en: "Cancel", ar: "إلغاء" },
  form_saving: { en: "Saving…", ar: "جارٍ الحفظ…" },
  form_required: { en: "Please fill in the doctor's English and Arabic names.", ar: "يرجى إدخال اسم الطبيب بالإنجليزية والعربية." },
  form_added: { en: "Doctor added successfully.", ar: "تمت إضافة الطبيب بنجاح." },

  // misc
  lang_en: { en: "English", ar: "الإنجليزية" },
  lang_ar: { en: "Arabic", ar: "العربية" },
  back: { en: "Back", ar: "رجوع" },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  poweredBy: { en: "Bilingual hospital voice agent demo", ar: "عرض المساعد الصوتي ثنائي اللغة للمستشفى" },
};

export function t(key: keyof typeof dict | string, lang: Language): string {
  const entry = dict[key];
  if (!entry) return key as string;
  return entry[lang];
}

// Mon=0 … Sun=6 (matches Python's date.weekday()).
const WEEKDAYS_SHORT = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ar: ["إثن", "ثلا", "أرب", "خمي", "جمع", "سبت", "أحد"],
};
export function weekdayShort(index: number, lang: Language): string {
  return WEEKDAYS_SHORT[lang][index] ?? "";
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpenNow, { TodayMark, type Period } from "./OpenNow";
import Motion from "./Motion";
import { THEMES, assistant, rubik, serif } from "./themes";

// דוגמת אתר לליד: דף ציבורי שהמוכרת שולחת אחרי השיחה. הנתונים מגוגל (demo.py).

type Demo = {
  name: string;
  type_label: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  maps_url: string;
  rating: number | null;
  review_count: number | null;
  hours: string[];
  periods: Period[];
  photos: string[];
  reviews: { text: string; author: string; rating: number }[];
  theme: string;
  copy: { headline?: string; subline?: string; points?: { title: string; text: string; quote: string }[] };
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getDemo(id: string): Promise<Demo | null> {
  const r = await fetch(`${API}/api/demo/${encodeURIComponent(id)}`, { next: { revalidate: 300 } });
  return r.ok ? r.json() : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const d = await getDemo(params.id);
  return {
    title: d ? `${d.name}${d.city ? ` · ${d.city}` : ""}` : "דוגמה",
    description: d?.copy?.subline || d?.type_label,
    robots: { index: false, follow: false },
    openGraph: d?.photos?.[0] ? { images: [d.photos[0]] } : undefined,
  };
}

const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

export default async function DemoPage({ params }: { params: { id: string } }) {
  const d = await getDemo(params.id);
  if (!d) notFound();
  const t = THEMES[d.theme] || THEMES.pro;
  const [hero, ...rest] = d.photos;
  const gallery = rest.slice(0, 5);
  const sidePhoto = rest[rest.length - 1] || hero;
  const points = d.copy?.points || [];
  const headline = d.copy?.headline || [d.type_label, d.city && `ב${d.city}`].filter(Boolean).join(" ");
  const wa = d.whatsapp ? `https://wa.me/${d.whatsapp}?text=${encodeURIComponent(`היי ${d.name}, הגעתי מהאתר`)}` : "";
  const rating = d.rating && d.review_count ? `${d.rating.toFixed(1)} מתוך 5 · ${d.review_count} ביקורות בגוגל` : "";

  const btn = "inline-flex min-h-12 items-center justify-center px-7 text-base font-bold transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";
  const primary = { background: t.accent, color: t.onAccent, outlineColor: t.accent };
  const secondary = { background: t.soft, color: t.ink, outlineColor: t.ink };
  const display = { fontFamily: t.display };

  const words = (text: string) => text.split(/\s+/).filter(Boolean);
  const h2 = "text-[clamp(2.25rem,5vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.03em]";

  return (
    <div
      className={`${serif.variable} ${rubik.variable} ${assistant.variable} min-h-screen overflow-x-clip`}
      style={{ background: t.ground, color: t.ink, fontFamily: "var(--f-text)" }}
    >
      {/* לפני ש-JS עולה: מסתירים רק את מה שהפתיחה מנפישה, כדי שלא יקפוץ */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('m')`,
        }}
      />
      <style>{`
        .m [data-hero-word]{transform:translateY(110%)}
        .m [data-hero-fade]{opacity:0}
        .m [data-hero-media]{clip-path:inset(100% 0 0 0)}
        html.lenis,html.lenis body{height:auto}
        .lenis.lenis-smooth{scroll-behavior:auto!important}
      `}</style>

      <Motion>
        {/* פס טיוטה: הלקוח יודע שזו דוגמה */}
        <div className="px-4 py-2 text-center text-sm sm:px-8" style={{ background: t.ink, color: t.ground }}>
          טיוטת עיצוב שהכנו עבור <bdi>{d.name}</bdi> · Halperin Designs
        </div>

        <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <span className="truncate text-xl font-bold" style={display}><bdi>{d.name}</bdi></span>
          {wa ? (
            <a href={wa} className={`${btn} min-h-10 px-5 text-sm`} style={primary}>וואטסאפ</a>
          ) : d.phone ? (
            <a href={telHref(d.phone)} className={`${btn} min-h-10 px-5 text-sm`} style={primary}>התקשרו</a>
          ) : null}
        </header>

        {/* פתיחה: התמונה נפתחת כמו תריס, השם עולה מילה אחר מילה */}
        <section className="grid gap-8 px-4 pb-24 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-12 lg:pb-40">
          {hero && (
            <div data-hero-media className="overflow-hidden lg:order-2 lg:col-span-7">
              <img src={hero} alt={d.name} className="aspect-[4/3] w-full object-cover will-change-transform lg:aspect-auto lg:h-[80vh]" />
            </div>
          )}
          <div className={`lg:order-1 ${hero ? "lg:col-span-5" : "lg:col-span-10 py-16"}`}>
            <h1 className="text-[clamp(2.75rem,8vw,8rem)] font-black leading-[0.95] tracking-[-0.03em]" style={display}>
              <bdi>
                {words(d.name).map((w, i) => (
                  <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                    <span data-hero-word className="inline-block">{w}</span>
                    {"\u00a0"}
                  </span>
                ))}
              </bdi>
            </h1>
            {headline && (
              <p data-hero-fade className="mt-8 max-w-[22ch] text-2xl font-semibold leading-snug sm:text-3xl">{headline}</p>
            )}
            {d.copy?.subline && <p data-hero-fade className="mt-4 max-w-[40ch] text-lg leading-relaxed">{d.copy.subline}</p>}
            <div data-hero-fade className="mt-8 space-y-2">
              <OpenNow periods={d.periods || []} accent={t.accent} />
              {rating && <p className="text-base">{rating}</p>}
            </div>
            <div data-hero-fade className="mt-8 flex flex-wrap gap-3">
              {wa && <a data-magnet href={wa} className={btn} style={primary}>שלחו הודעה בוואטסאפ</a>}
              {d.phone && <a href={telHref(d.phone)} className={btn} style={wa ? secondary : primary}>{d.phone}</a>}
            </div>
          </div>
        </section>

        {/* למה חוזרים: מה שהלקוחות עצמם כותבים */}
        {points.length > 0 && (
          <section data-section className="grid gap-12 px-4 py-24 sm:px-8 lg:grid-cols-12 lg:py-40" style={{ background: t.soft }}>
            <div className="lg:col-span-5">
              <h2 data-reveal className={h2} style={display}>למה חוזרים אלינו</h2>
              {sidePhoto && <img data-reveal src={sidePhoto} alt="" className="mt-10 aspect-[4/5] w-full object-cover" loading="lazy" />}
            </div>
            <ul className="space-y-16 lg:col-span-6 lg:col-start-7 lg:self-center">
              {points.map((p, i) => (
                <li key={i} data-reveal>
                  <h3 className="text-3xl font-bold leading-tight sm:text-5xl" style={display}>{p.title}</h3>
                  <p className="mt-4 max-w-[45ch] text-lg leading-relaxed">{p.text}</p>
                  <p className="mt-3 text-xl font-semibold" style={{ color: t.accent }}>"{p.quote}"</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* הרגע המרכזי: הגלריה ננעלת וזזה הצידה עם הגלילה */}
        {gallery.length >= 2 && (
          <section data-hscroll className="overflow-hidden py-24 lg:flex lg:h-screen lg:flex-col lg:justify-center lg:py-0">
            <h2 className={`${h2} px-4 sm:px-8`} style={display}>מבפנים</h2>
            <div
              data-track
              className="mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:px-8 lg:mt-12 lg:snap-none lg:gap-5 lg:overflow-visible"
            >
              {gallery.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading={i < 2 ? "eager" : "lazy"}
                  className={`h-[60vh] max-h-[34rem] shrink-0 snap-start object-cover lg:h-[62vh] lg:max-h-none ${
                    i % 2 ? "w-[70vw] lg:w-[30vw]" : "w-[85vw] lg:w-[44vw]"
                  }`}
                />
              ))}
            </div>
          </section>
        )}

        {/* ביקורות: שדה צבע שלם, המילים נדלקות עם הגלילה */}
        {d.reviews.length > 0 && (
          <section data-section className="px-4 py-24 sm:px-8 lg:py-40" style={{ background: t.accent, color: t.onAccent }}>
            <h2 data-reveal className={`${h2} max-w-[18ch]`} style={display}>מה כתבו עלינו בגוגל</h2>
            <div className="mt-16 space-y-16 lg:space-y-24">
              {d.reviews.map((r, i) => (
                <figure key={i} className={`max-w-[44ch] ${i % 2 ? "lg:mr-auto" : ""}`}>
                  <blockquote data-scrub className="text-2xl font-semibold leading-snug sm:text-[2.25rem]">
                    {words(r.text).map((w, j) => (
                      <span key={j} data-scrub-word>{w} </span>
                    ))}
                  </blockquote>
                  {r.author && <figcaption className="mt-5 text-base font-semibold opacity-80">{r.author}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* מתי ואיפה */}
        <section data-section className="grid gap-12 px-4 py-24 sm:px-8 lg:grid-cols-12 lg:py-40">
          <div className="lg:col-span-5">
            <h2 data-reveal className={h2} style={display}>שעות וכתובת</h2>
            {d.address && <p data-reveal className="mt-8 text-2xl font-semibold leading-snug">{d.address}</p>}
            <div data-reveal className="mt-8 flex flex-wrap gap-3">
              {d.maps_url && <a data-magnet href={d.maps_url} className={btn} style={primary}>ניווט לעסק</a>}
              {d.phone && <a href={telHref(d.phone)} className={btn} style={secondary}>התקשרו</a>}
            </div>
          </div>
          {d.hours.length > 0 && (
            <table data-reveal className="w-full text-lg lg:col-span-6 lg:col-start-7">
              <tbody>
                {d.hours.map((h, i) => {
                  const [day, ...time] = h.split(": ");
                  return (
                    <TodayMark key={i} index={i}>
                      <td className="py-3" style={{ borderBottom: `1px solid ${t.soft}` }}>{day}</td>
                      <td className="py-3 text-left tabular-nums" style={{ borderBottom: `1px solid ${t.soft}` }} dir="ltr">
                        {time.join(": ") || ""}
                      </td>
                    </TodayMark>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <footer data-section className="px-4 pb-10 pt-20 sm:px-8" style={{ background: t.ink, color: t.ground }}>
          <p data-reveal className="text-[clamp(2.5rem,10vw,9rem)] font-black leading-[0.9] tracking-[-0.03em]" style={display}>
            <bdi>{d.name}</bdi>
          </p>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-4 text-sm opacity-80">
            <span>תמונות וביקורות: Google</span>
            <span>טיוטה לדוגמה · Halperin Designs</span>
          </div>
        </footer>
      </Motion>
    </div>
  );
}

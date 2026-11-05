"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * שכבת התנועה של דף הדוגמה. הכל עובד מ-data attributes שבדף:
 *   [data-hero-word]   מילה בכותרת הראשית, עולה מתוך המסכה שלה
 *   [data-hero-media]  התמונה הראשית, נפתחת כמו תריס של חנות
 *   [data-hero-fade]   שאר הפתיחה, אחרי הכותרת
 *   [data-section]     כל אזור; [data-reveal] בתוכו נכנסים בדירוג
 *   [data-hscroll]     הגלריה: ננעלת וזזה הצידה עם הגלילה (במחשב)
 *   [data-scrub-word]  מילה בביקורת, נדלקת לפי הגלילה
 *   [data-magnet]      כפתור שנמשך לעכבר
 * prefers-reduced-motion: בלי Lenis ובלי תנועה, הכל במצב הסופי.
 */
export default function Motion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const html = document.documentElement;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        html.classList.remove("m");
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const lenis = new Lenis({ autoRaf: false, lerp: 0.1 });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        // פתיחה: תריס, שם, ואז השאר
        const tl = gsap.timeline({ defaults: { ease: "expo.out" }, onStart: () => html.classList.remove("m") });
        tl.fromTo("[data-hero-media]", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut" })
          .fromTo("[data-hero-media] img", { scale: 1.25 }, { scale: 1, duration: 1.8 }, 0)
          // y: 0 במפורש: אחרת GSAP קורא את ה-translateY של מחלקת ההסתרה כבסיס ונעצר שם
          .fromTo("[data-hero-word]", { y: 0, yPercent: 110 }, { y: 0, yPercent: 0, duration: 1.1, stagger: 0.08 }, 0.45)
          .fromTo("[data-hero-fade]", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.8);

        // התמונה הראשית זזה לאט כשגוללים ממנה
        gsap.to("[data-hero-media] img", {
          yPercent: 12,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero-media]", start: "top top", end: "bottom top", scrub: true },
        });

        // כל אזור: הכותרת, אחר כך הטקסט, אחר כך התמונות
        gsap.utils.toArray<HTMLElement>("[data-section]").forEach((sec) => {
          const items = sec.querySelectorAll("[data-reveal]");
          if (!items.length) return;
          gsap.fromTo(
            items,
            { autoAlpha: 0, y: 32 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.9,
              ease: "power3.out",
              stagger: 0.08,
              scrollTrigger: { trigger: sec, start: "top 78%", once: true },
            }
          );
        });

        // הביקורות נדלקות מילה אחר מילה לפי הגלילה
        gsap.utils.toArray<HTMLElement>("[data-scrub]").forEach((q) => {
          gsap.fromTo(
            q.querySelectorAll("[data-scrub-word]"),
            { opacity: 0.18 },
            { opacity: 1, stagger: 0.04, ease: "none", scrollTrigger: { trigger: q, start: "top 85%", end: "bottom 55%", scrub: true } }
          );
        });

        // כפתור מגנטי, רק עם עכבר
        const cleanups: (() => void)[] = [];
        if (window.matchMedia("(pointer: fine)").matches) {
          gsap.utils.toArray<HTMLElement>("[data-magnet]").forEach((el) => {
            const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
            const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
            const move = (e: PointerEvent) => {
              const r = el.getBoundingClientRect();
              x((e.clientX - (r.left + r.width / 2)) * 0.3);
              y((e.clientY - (r.top + r.height / 2)) * 0.3);
            };
            const leave = () => {
              x(0);
              y(0);
            };
            el.addEventListener("pointermove", move);
            el.addEventListener("pointerleave", leave);
            cleanups.push(() => {
              el.removeEventListener("pointermove", move);
              el.removeEventListener("pointerleave", leave);
            });
          });
        }

        return () => {
          cleanups.forEach((c) => c());
          gsap.ticker.remove(tick);
          lenis.destroy();
        };
      });

      // הרגע המרכזי: הגלריה ננעלת וזזה הצידה. במחשב בלבד; בטלפון היא נגללת רגיל.
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 1024px)", () => {
        const wrap = document.querySelector<HTMLElement>("[data-hscroll]");
        const track = wrap?.querySelector<HTMLElement>("[data-track]");
        if (!wrap || !track) return;
        const distance = () => Math.max(track.scrollWidth - wrap.clientWidth, 0);
        gsap.to(track, {
          x: () => distance(), // RTL: התוכן ממשיך שמאלה, אז זזים ימינה
          ease: "none",
          scrollTrigger: { trigger: wrap, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
        });
      });

      // רשת ביטחון: אם משהו נכשל, לא משאירים תוכן מוסתר
      const safety = setTimeout(() => html.classList.remove("m"), 2500);
      return () => {
        clearTimeout(safety);
        mm.revert();
      };
    },
    { scope: root }
  );

  return <div ref={root}>{children}</div>;
}

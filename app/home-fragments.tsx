"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import "./home-fragments.css";

const collections = [
  {
    title: "雪境与水线", author: "Hengki Koentjoro",
    source: "https://www.hasselblad.com/inspiration/stories/hengki-koentjoro-monochromatic-minimalism-with-the-x1d/",
    images: [
      { src: "/editorial-fragments-a-1.jpg", width: 2560, height: 2560, caption: "雪中林带", alt: "雪原中的一片林带，深色树干与柔和灰阶构成安静的黑白画面" },
      { src: "/editorial-fragments-a-2.jpg", width: 3000, height: 2249, caption: "海岸与水线", alt: "北海道覆雪的海岸，平静的水面沿雪地弯出一道流畅的曲线" },
    ],
  },
  {
    title: "盐岩与暮色", author: "Chiara Zonca",
    source: "https://www.hasselblad.com/inspiration/stories/chiara-zonca-x1d-50c-500c-exploring-beautiful-oddities/",
    images: [
      { src: "/editorial-fragments-b-1.jpg", width: 1874, height: 2500, caption: "盐湖的暮色", alt: "阿塔卡马沙漠的盐岩与浅水，粉色岩壁倒映在蓝灰色水面上" },
      { src: "/editorial-fragments-b-2.jpg", width: 1800, height: 1800, caption: "岩层与褶皱", alt: "红褐色岩石的近景与远处浅色岩层，呈现柔和色彩和粗粝纹理" },
    ],
  },
  {
    title: "光与曲面", author: "Swee Oh",
    source: "https://www.hasselblad.com/inspiration/masters/2016/swee-oh/",
    images: [
      { src: "/editorial-fragments-c-1.jpg", width: 1500, height: 1500, caption: "曲面中的窗口", alt: "白色建筑表面围绕蓝色窗口起伏，路人的身影衬出建筑的尺度" },
      { src: "/editorial-fragments-c-2.jpg", width: 1500, height: 1500, caption: "仰视的纹理", alt: "仰视白色建筑的蜂窝状曲面，重复的孔洞和深蓝天空形成光影对比" },
    ],
  },
];

export default function HomeFragments() {
  const [frame, setFrame] = useState<{ active: number; previous: number | null }>({ active: 0, previous: null });
  const active = frame.active;
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [nearViewport, setNearViewport] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const galleryRef = useRef<HTMLDivElement>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const select = (index: number) => {
    setFrame(current => current.active === index ? current : { active: index, previous: reducedMotion ? null : current.active });
  };
  const change = (step: number) => {
    setFrame(current => ({ active: (current.active + step + collections.length) % collections.length, previous: reducedMotion ? null : current.active }));
  };

  useEffect(() => {
    if (!("IntersectionObserver" in window)) { setNearViewport(true); return; }
    const gallery = galleryRef.current;
    if (!gallery) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px 0px" });
    observer.observe(gallery);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setReducedMotion(motion.matches);
      if (motion.matches) {
        setFrame(current => current.previous === null ? current : { ...current, previous: null });
      }
    };
    updateMotion();
    motion.addEventListener("change", updateMotion);
    return () => {
      motion.removeEventListener("change", updateMotion);
    };
  }, []);

  useEffect(() => {
    // Every newly selected collection gets a full five seconds, including manual
    // navigation. Hover, focus, touch and scroll never stop the rotation.
    const timer = window.setTimeout(() => setFrame(current => ({ active: (current.active + 1) % collections.length, previous: reducedMotion ? null : current.active })), 5000);
    return () => window.clearTimeout(timer);
  }, [active, reducedMotion]);

  return (
    <div ref={galleryRef} className="pub-fragment-gallery" role="region" aria-roledescription="轮播图" aria-label="影像随笔，三组摄影" tabIndex={0}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault(); change(event.key === "ArrowLeft" ? -1 : 1);
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault(); select(event.key === "Home" ? 0 : collections.length - 1);
        }
      }}>
      <div className="pub-fragment-stage"
        onTouchStart={event => {
          touchOrigin.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
        }}
        onTouchMove={event => { if (event.touches.length !== 1) touchOrigin.current = null; }}
        onTouchCancel={() => { touchOrigin.current = null; }}
        onTouchEnd={event => {
          const origin = touchOrigin.current; touchOrigin.current = null;
          if (!origin || event.touches.length || !event.changedTouches.length) return;
          const dx = event.changedTouches[0].clientX - origin.x;
          const dy = event.changedTouches[0].clientY - origin.y;
          if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.3) change(dx < 0 ? 1 : -1);
        }}>
        {collections.map((collection, index) => (
          <div className={`pub-fragment-slide${active === index ? " is-active" : frame.previous === index ? " is-previous" : ""}`} key={collection.title}
            role="group" aria-roledescription="幻灯片" aria-label={`${index + 1} / ${collections.length}，${collection.title}`}
            aria-hidden={active !== index} inert={active !== index}
            onAnimationEnd={event => {
              if (event.target !== event.currentTarget || index !== active) return;
              setFrame(current => current.active === index && current.previous !== null ? { ...current, previous: null } : current);
            }}>
            {collection.images.map((photo, imageIndex) => (
              <figure className={`pub-fragment-photo ${imageIndex === 0 ? "is-main" : "is-detail"}`} key={photo.src}>
                <div className="pub-fragment-window">
                  {failedImages[photo.src] ? <div className="pub-fragment-fallback"><span>影像暂未载入</span><a href={collection.source} target="_blank" rel="noopener noreferrer">查看原作 ↗</a></div> :
                    <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading={nearViewport ? "eager" : "lazy"} decoding="async" draggable={false}
                      onError={() => setFailedImages(current => ({ ...current, [photo.src]: true }))} />}
                </div>
                <figcaption><span>{String(imageIndex + 1).padStart(2, "0")} / {photo.caption}</span></figcaption>
              </figure>
            ))}
            <div className="pub-fragment-credit"><span>{collection.title}</span><a href={collection.source} target="_blank" rel="noopener noreferrer" aria-label={`摄影：${collection.author}，查看${collection.title}官方出处（新窗口）`}>© {collection.author} <ArrowUpRight size={11} aria-hidden="true" /></a></div>
          </div>
        ))}
      </div>
      <div className="pub-fragment-controls">
        <div className="pub-fragment-selectors" role="group" aria-label="选择摄影组">
          {collections.map((collection, index) => <button key={collection.title} type="button" aria-label={`查看第 ${index + 1} 组：${collection.title}`} aria-pressed={active === index} onClick={() => select(index)}><span>{String(index + 1).padStart(2, "0")}</span></button>)}
        </div>
        <div className="pub-fragment-arrows">
          <button type="button" onClick={() => change(-1)} aria-label="上一组摄影"><ArrowLeft size={17} aria-hidden="true" /></button><button type="button" onClick={() => change(1)} aria-label="下一组摄影"><ArrowRight size={17} aria-hidden="true" /></button>
        </div>
      </div>
      <p className="sr-only" aria-live="off">第 {active + 1} 组，共 {collections.length} 组：{collections[active].title}。每 5 秒自动切换，可使用左右方向键切换。</p>
    </div>
  );
}

"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  useAnimatedIconTrigger,
  XIcon,
} from "./AnimatedLucideIcons";

const EMPTY_IMAGES = [];
const MODAL_IMAGE_WIDTH = 1600;

function isSanityImage(src) {
  return src.startsWith("https://cdn.sanity.io/");
}

function galleryImageUrl(src, width, quality = 80) {
  if (!(src && isSanityImage(src))) {
    return src;
  }

  const url = new URL(src);
  url.searchParams.set("w", String(Math.min(width, MODAL_IMAGE_WIDTH)));
  url.searchParams.set("q", String(quality));
  url.searchParams.set("fit", "max");
  url.searchParams.set("auto", "format");
  return url.toString();
}

function sanityImageLoader({ src, width }) {
  return galleryImageUrl(src, width);
}

function loaderFor(src) {
  return isSanityImage(src) ? sanityImageLoader : undefined;
}

function imageIdentity(item) {
  return item?.asset?._id || item?._key || item?.asset?.url || null;
}

function imageLabel(item, index) {
  return item.alt?.trim() || `Gallery image ${index + 1}`;
}

function tilePreview(index) {
  return document.querySelector(`[data-gallery-index="${index}"] img`)?.currentSrc || null;
}

function moveGallery(current, offset, imageCount) {
  if (current.selectedIndex === null) {
    return { ...current, direction: offset };
  }

  const selectedIndex = (current.selectedIndex + offset + imageCount) % imageCount;
  return {
    direction: offset,
    previewSrc: tilePreview(selectedIndex),
    selectedIndex,
  };
}

function getSlideVariants(shouldReduceMotion) {
  return shouldReduceMotion
    ? {
        center: { opacity: 1, transform: "translateX(0)" },
        enter: { opacity: 0, transform: "translateX(0)" },
        exit: { opacity: 0, transform: "translateX(0)" },
      }
    : {
        center: { opacity: 1, transform: "translateX(0)", zIndex: 1 },
        enter: (nextDirection) => ({
          opacity: 0,
          transform: `translateX(${nextDirection > 0 ? "100%" : "-100%"})`,
        }),
        exit: (nextDirection) => ({
          opacity: 0,
          transform: `translateX(${nextDirection < 0 ? "100%" : "-100%"})`,
          zIndex: 0,
        }),
      };
}

function getSlideTransition(shouldReduceMotion) {
  return shouldReduceMotion
    ? { duration: 0 }
    : {
        opacity: { duration: 0.2 },
        transform: { damping: 30, stiffness: 300, type: "spring" },
      };
}

function previewClassName(isLoaded) {
  return cn(
    "object-contain blur-[2px] transition-[opacity,filter] duration-300 motion-reduce:transition-none",
    isLoaded ? "opacity-0 blur-none" : "opacity-70"
  );
}

function imageClassName(isLoaded) {
  return cn(
    "z-10 object-contain transition-opacity duration-300 motion-reduce:transition-none",
    isLoaded ? "opacity-100" : "opacity-0"
  );
}

export default function GalleryGrid({ images = EMPTY_IMAGES, className }) {
  const [{ selectedIndex, direction, previewSrc }, setGallery] = useState({
    direction: 0,
    previewSrc: null,
    selectedIndex: null,
  });
  const closeButtonRef = useRef(null);
  const closeIconRef = useRef(null);
  const nextIconRef = useRef(null);
  const previousIconRef = useRef(null);
  const closeIconTrigger = useAnimatedIconTrigger(closeIconRef);
  const nextIconTrigger = useAnimatedIconTrigger(nextIconRef);
  const previousIconTrigger = useAnimatedIconTrigger(previousIconRef);
  const shouldReduceMotion = !!useReducedMotion();
  const selectedImage = images[selectedIndex] ?? null;
  const selectedIdentity = imageIdentity(selectedImage);
  const [loadedIdentity, setLoadedIdentity] = useState(null);

  const close = () => setGallery((current) => ({ ...current, selectedIndex: null }));
  const handleNext = () => setGallery((current) => moveGallery(current, 1, images.length));
  const handlePrev = () => setGallery((current) => moveGallery(current, -1, images.length));
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      close();
    }
  };
  const handleTileClick = (event) => {
    setGallery({
      direction: 0,
      previewSrc: event.currentTarget.querySelector("img")?.currentSrc || null,
      selectedIndex: Number(event.currentTarget.dataset.galleryIndex),
    });
  };
  const handleDialogKeyDown = (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      handleNext();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      handlePrev();
    }
  };

  const slideVariants = getSlideVariants(shouldReduceMotion);

  return (
    <>
      <m.div
        className={cn("grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3", className)}
        initial="hidden"
        variants={{
          show: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.07 } },
        }}
        viewport={{ amount: 0.1, once: true }}
        whileInView="show"
      >
        {images.map((item, index) => {
          const identity = imageIdentity(item);
          const label = imageLabel(item, index);
          return (
            <m.button
              aria-expanded={selectedIndex === index}
              aria-haspopup="dialog"
              aria-label={`Open ${label}`}
              className="public-media-edge group relative aspect-[4/3] w-full cursor-pointer overflow-hidden bg-brand-light focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4"
              data-gallery-index={index}
              key={identity || `${item.asset?.url || "gallery"}-${label}`}
              layoutId={shouldReduceMotion || !identity ? undefined : `image-container-${identity}`}
              onClick={handleTileClick}
              type="button"
            >
              <Image
                alt={item.alt || ""}
                className="object-cover transition-transform duration-300 fine-hover:group-hover:scale-105 motion-reduce:transform-none"
                fetchPriority="low"
                fill
                loader={loaderFor(item.asset?.url || "")}
                loading="lazy"
                sizes="(max-width: 639px) 100vw, (max-width: 767px) 50vw, 384px"
                src={item.asset?.url || ""}
              />
            </m.button>
          );
        })}
      </m.div>

      <ControlledDialog
        backdropClassName="fixed inset-0 bg-public-night/95 backdrop-blur-sm"
        initialFocus={closeButtonRef}
        onOpenChange={handleOpenChange}
        open={selectedImage !== null}
        popupClassName="pointer-events-auto relative z-10 flex size-full items-center justify-center outline-none"
        popupRender={
          <m.div
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            onKeyDown={handleDialogKeyDown}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
          />
        }
        triggerless
        viewportClassName="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      >
        <ControlledDialogTitle className="sr-only">Gallery viewer</ControlledDialogTitle>
        {selectedImage ? (
          <div className="flex size-full max-w-7xl flex-col">
            <div className="flex items-start justify-between gap-6 px-1 pb-4 text-white sm:px-2">
              <div className="min-w-0">
                <p className="text-sm text-white/55 tabular-nums">
                  {String(selectedIndex + 1).padStart(2, "0")} /{" "}
                  {String(images.length).padStart(2, "0")}
                </p>
                <p className="mt-1 max-w-2xl truncate text-sm text-white/85 sm:text-base">
                  {imageLabel(selectedImage, selectedIndex)}
                </p>
              </div>
              <button
                aria-label="Close gallery"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-[background-color,transform] duration-200 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:scale-95"
                onClick={close}
                ref={closeButtonRef}
                type="button"
                {...closeIconTrigger}
              >
                <XIcon aria-hidden="true" ref={closeIconRef} size={24} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-rows-1 sm:gap-5">
              <button
                aria-label="Previous image"
                className="col-start-1 row-start-2 inline-flex min-h-11 min-w-16 items-center justify-center justify-self-end rounded-full border border-white/15 bg-white/5 text-white transition-[background-color,transform] duration-200 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:scale-95 sm:col-start-1 sm:row-start-1 sm:min-h-12 sm:min-w-12"
                onClick={handlePrev}
                type="button"
                {...previousIconTrigger}
              >
                <ArrowLeftIcon aria-hidden="true" ref={previousIconRef} size={26} />
              </button>

              <div className="relative col-span-2 row-start-1 min-h-0 self-stretch overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25 shadow-[0_28px_80px_rgba(0,0,0,0.35)] sm:col-span-1 sm:col-start-2 sm:rounded-[2rem]">
                <AnimatePresence custom={direction} initial={false} mode="popLayout">
                  <m.div
                    animate="center"
                    className="absolute inset-3 sm:inset-5"
                    custom={direction}
                    exit="exit"
                    initial="enter"
                    key={selectedIdentity || imageLabel(selectedImage, selectedIndex)}
                    layoutId={
                      shouldReduceMotion || !selectedIdentity
                        ? undefined
                        : `image-container-${selectedIdentity}`
                    }
                    transition={getSlideTransition(shouldReduceMotion)}
                    variants={slideVariants}
                  >
                    {previewSrc ? (
                      <Image
                        alt=""
                        aria-hidden="true"
                        className={previewClassName(loadedIdentity === selectedIdentity)}
                        fill
                        sizes="(max-width: 639px) calc(100vw - 3.5rem), (max-width: 1023px) calc(100vw - 10rem), 1120px"
                        src={previewSrc}
                        unoptimized
                      />
                    ) : null}
                    <div
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-0 rounded-xl bg-white/[0.06] transition-opacity duration-300 motion-reduce:transition-none",
                        loadedIdentity === selectedIdentity ? "opacity-0" : "opacity-100"
                      )}
                    >
                      <div className="absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-public-lime to-transparent motion-reduce:animate-none" />
                    </div>
                    <Image
                      alt={selectedImage.alt || ""}
                      className={imageClassName(loadedIdentity === selectedIdentity)}
                      fetchPriority="high"
                      fill
                      loader={loaderFor(selectedImage.asset?.url || "")}
                      loading="eager"
                      onLoad={() => setLoadedIdentity(selectedIdentity)}
                      sizes="(max-width: 639px) calc(100vw - 3.5rem), (max-width: 1023px) calc(100vw - 10rem), 1120px"
                      src={selectedImage.asset?.url || ""}
                    />
                  </m.div>
                </AnimatePresence>
              </div>

              <button
                aria-label="Next image"
                className="col-start-2 row-start-2 inline-flex min-h-11 min-w-16 items-center justify-center justify-self-start rounded-full border border-white/15 bg-white/5 text-white transition-[background-color,transform] duration-200 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:scale-95 sm:col-start-3 sm:row-start-1 sm:min-h-12 sm:min-w-12"
                onClick={handleNext}
                type="button"
                {...nextIconTrigger}
              >
                <ArrowRightIcon aria-hidden="true" ref={nextIconRef} size={26} />
              </button>
            </div>

            <p className="sr-only" role="status">
              Image {selectedIndex + 1} of {images.length}:{" "}
              {imageLabel(selectedImage, selectedIndex)}
            </p>
          </div>
        ) : null}
      </ControlledDialog>
    </>
  );
}

"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { cn } from "@/lib/utils";

const EMPTY_IMAGES = [];

function imageIdentity(item) {
  return item.asset?._id || item._key || item.asset?.url || null;
}

function imageLabel(item, index) {
  return item.alt?.trim() || `Gallery image ${index + 1}`;
}

export default function GalleryGrid({ images = EMPTY_IMAGES, className }) {
  const [{ selectedIndex, direction }, setGallery] = useState({
    direction: 0,
    selectedIndex: null,
  });
  const closeButtonRef = useRef(null);
  const shouldReduceMotion = !!useReducedMotion();
  const selectedImage = selectedIndex === null ? null : images[selectedIndex];

  const close = useCallback(
    () => setGallery((current) => ({ ...current, selectedIndex: null })),
    []
  );
  const handleNext = useCallback(
    () =>
      setGallery((current) => ({
        direction: 1,
        selectedIndex:
          current.selectedIndex === null ? null : (current.selectedIndex + 1) % images.length,
      })),
    [images.length]
  );
  const handlePrev = useCallback(
    () =>
      setGallery((current) => ({
        direction: -1,
        selectedIndex:
          current.selectedIndex === null
            ? null
            : (current.selectedIndex - 1 + images.length) % images.length,
      })),
    [images.length]
  );
  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen) {
        close();
      }
    },
    [close]
  );
  const handleTileClick = useCallback((event) => {
    setGallery({
      direction: 0,
      selectedIndex: Number(event.currentTarget.dataset.galleryIndex),
    });
  }, []);
  const handleDialogKeyDown = useCallback(
    (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
      }
    },
    [handleNext, handlePrev]
  );

  const slideVariants = shouldReduceMotion
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
              key={identity || `${label}-${index}`}
              layoutId={shouldReduceMotion || !identity ? undefined : `image-container-${identity}`}
              onClick={handleTileClick}
              type="button"
            >
              <Image
                alt={item.alt || ""}
                className="object-cover transition-transform duration-300 fine-hover:group-hover:scale-105 motion-reduce:transform-none"
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                src={item.asset?.url || ""}
              />
            </m.button>
          );
        })}
      </m.div>

      <ControlledDialog
        backdropClassName="fixed inset-0 bg-public-night/90"
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
        viewportClassName="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <ControlledDialogTitle className="sr-only">Gallery viewer</ControlledDialogTitle>
        {selectedImage ? (
          <>
            <button
              aria-label="Previous image"
              className="absolute top-1/2 left-1 z-20 min-h-11 min-w-11 -translate-y-1/2 rounded-full p-2 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 sm:left-4"
              onClick={handlePrev}
              type="button"
            >
              <ArrowLeft aria-hidden="true" className="size-8" />
            </button>
            <button
              aria-label="Next image"
              className="absolute top-1/2 right-1 z-20 min-h-11 min-w-11 -translate-y-1/2 rounded-full p-2 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 sm:right-4"
              onClick={handleNext}
              type="button"
            >
              <ArrowRight aria-hidden="true" className="size-8" />
            </button>

            <div className="public-media-edge relative aspect-[4/3] w-full max-w-5xl overflow-hidden">
              <AnimatePresence custom={direction} initial={false} mode="popLayout">
                <m.div
                  animate="center"
                  className="absolute inset-0"
                  custom={direction}
                  exit="exit"
                  initial="enter"
                  key={imageIdentity(selectedImage) || imageLabel(selectedImage, selectedIndex)}
                  layoutId={
                    shouldReduceMotion || !imageIdentity(selectedImage)
                      ? undefined
                      : `image-container-${imageIdentity(selectedImage)}`
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          opacity: { duration: 0.2 },
                          transform: { damping: 30, stiffness: 300, type: "spring" },
                        }
                  }
                  variants={slideVariants}
                >
                  <Image
                    alt={selectedImage.alt || ""}
                    className="object-contain"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 1024px"
                    src={selectedImage.asset?.url || ""}
                  />
                </m.div>
              </AnimatePresence>
            </div>

            <p className="sr-only" role="status">
              {imageLabel(selectedImage, selectedIndex)}
            </p>
            <button
              aria-label="Close gallery"
              className="absolute top-[max(1rem,var(--safe-area-inset-top))] right-[max(1rem,var(--safe-area-inset-right))] z-20 min-h-11 min-w-11 rounded-full p-2 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              onClick={close}
              ref={closeButtonRef}
              type="button"
            >
              <X aria-hidden="true" className="size-8" />
            </button>
          </>
        ) : null}
      </ControlledDialog>
    </>
  );
}

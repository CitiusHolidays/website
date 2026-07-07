"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import { useEffect, useReducer } from "react";
import { cn } from "../../utils/cn";

const variants = {
  center: {
    opacity: 1,
    x: 0,
    zIndex: 1,
  },
  enter: (direction) => ({
    opacity: 0,
    x: direction > 0 ? "100%" : "-100%",
  }),
  exit: (direction) => ({
    opacity: 0,
    x: direction < 0 ? "100%" : "-100%",
    zIndex: 0,
  }),
};

const EMPTY_IMAGES = [];

function galleryReducer(state, action) {
  switch (action.type) {
    case "open":
      return { direction: 0, selectedIndex: action.index };
    case "close":
      return { ...state, selectedIndex: null };
    case "next":
      return {
        direction: 1,
        selectedIndex:
          state.selectedIndex === null
            ? state.selectedIndex
            : (state.selectedIndex + 1) % action.length,
      };
    case "prev":
      return {
        direction: -1,
        selectedIndex:
          state.selectedIndex === null
            ? state.selectedIndex
            : (state.selectedIndex - 1 + action.length) % action.length,
      };
    default:
      return state;
  }
}

export default function GalleryGrid({ images = EMPTY_IMAGES, className }) {
  const [{ selectedIndex, direction }, dispatch] = useReducer(galleryReducer, {
    direction: 0,
    selectedIndex: null,
  });

  const handleNext = () => {
    dispatch({ length: images.length, type: "next" });
  };

  const handlePrev = () => {
    dispatch({ length: images.length, type: "prev" });
  };

  const close = () => {
    dispatch({ type: "close" });
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        dispatch({ type: "close" });
      }
      if (e.key === "ArrowRight") {
        dispatch({ length: images.length, type: "next" });
      }
      if (e.key === "ArrowLeft") {
        dispatch({ length: images.length, type: "prev" });
      }
    };
    if (selectedIndex !== null) {
      window.addEventListener("keydown", handleKey);
    }
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [selectedIndex, images.length]);

  return (
    <>
      <m.div
        className={cn("grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3", className)}
        initial="hidden"
        variants={{
          show: { transition: { staggerChildren: 0.07 } },
        }}
        viewport={{ amount: 0.1, once: true }}
        whileInView="show"
      >
        {images.map((item, index) => (
          <m.div
            className="group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-lg bg-brand-light"
            key={item.asset?._id || item._key || index}
            layoutId={`image-container-${item.asset?._id || index}`}
            onClick={() => {
              dispatch({ index, type: "open" });
            }}
            // variants={{
            //   hidden: { opacity: 0, y: 20 },
            //   show: { opacity: 1, y: 0 },
            // }}
          >
            <Image
              alt={item.alt || ""}
              className={cn("object-cover transition-transform duration-300 group-hover:scale-105")}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              src={item.asset?.url || ""}
            />
          </m.div>
        ))}
      </m.div>

      <AnimatePresence>
        {selectedIndex !== null && images[selectedIndex] && (
          <div className="fixed inset-0 z-50">
            <m.button
              animate={{ opacity: 1 }}
              aria-label="Close gallery"
              className="absolute inset-0 cursor-default border-0 bg-brand-dark/80 p-0 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={close}
              transition={{ duration: 0.3 }}
              type="button"
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
              <m.button
                aria-label="Previous Image"
                className="absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full p-2 text-white transition-colors hover:bg-white/20 sm:left-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
              >
                <ArrowLeft className="size-8" />
              </m.button>
              <m.button
                aria-label="Next Image"
                className="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full p-2 text-white transition-colors hover:bg-white/20 sm:right-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
              >
                <ArrowRight className="size-8" />
              </m.button>

              <m.div
                className="relative aspect-[4/3] w-full max-w-5xl overflow-hidden rounded-lg shadow-2xl"
                layoutId={`image-container-${images[selectedIndex].asset?._id || selectedIndex}`}
                onClick={(e) => e.stopPropagation()}
              >
                <AnimatePresence custom={direction} initial={false}>
                  <m.div
                    animate="center"
                    className="absolute inset-0"
                    custom={direction}
                    exit="exit"
                    initial="enter"
                    key={selectedIndex}
                    transition={{
                      opacity: { duration: 0.2 },
                      x: { damping: 30, stiffness: 300, type: "spring" },
                    }}
                    variants={variants}
                  >
                    <Image
                      alt={images[selectedIndex].alt || ""}
                      className="object-contain"
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 1024px"
                      src={images[selectedIndex].asset?.url || ""}
                    />
                  </m.div>
                </AnimatePresence>
              </m.div>
            </div>

            <m.button
              aria-label="Close"
              className="absolute top-4 right-4 z-10 text-white hover:scale-110"
              onClick={close}
            >
              <X className="size-8" />
            </m.button>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

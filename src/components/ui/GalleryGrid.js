"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { AnimatePresence, m as motion } from "motion/react";
import Image from "next/image";
import { useEffect, useReducer } from "react";
import { cn } from "../../utils/cn";

const variants = {
  enter: (direction) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    zIndex: 0,
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
  }),
};

const EMPTY_IMAGES = [];

function galleryReducer(state, action) {
  switch (action.type) {
    case "open":
      return { selectedIndex: action.index, direction: 0 };
    case "close":
      return { ...state, selectedIndex: null };
    case "next":
      return {
        selectedIndex:
          state.selectedIndex === null
            ? state.selectedIndex
            : (state.selectedIndex + 1) % action.length,
        direction: 1,
      };
    case "prev":
      return {
        selectedIndex:
          state.selectedIndex === null
            ? state.selectedIndex
            : (state.selectedIndex - 1 + action.length) % action.length,
        direction: -1,
      };
    default:
      return state;
  }
}

export default function GalleryGrid({ images = EMPTY_IMAGES, className }) {
  const [{ selectedIndex, direction }, dispatch] = useReducer(galleryReducer, {
    selectedIndex: null,
    direction: 0,
  });

  const handleNext = () => {
    dispatch({ type: "next", length: images.length });
  };

  const handlePrev = () => {
    dispatch({ type: "prev", length: images.length });
  };

  const close = () => {
    dispatch({ type: "close" });
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") dispatch({ type: "close" });
      if (e.key === "ArrowRight") {
        dispatch({ type: "next", length: images.length });
      }
      if (e.key === "ArrowLeft") {
        dispatch({ type: "prev", length: images.length });
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
      <motion.div
        className={cn("grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3", className)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        variants={{
          show: { transition: { staggerChildren: 0.07 } },
        }}
      >
        {images.map((item, index) => (
          <motion.div
            key={item.asset?._id || item._key || index}
            layoutId={`image-container-${item.asset?._id || index}`}
            onClick={() => {
              dispatch({ type: "open", index });
            }}
            className="aspect-[4/3] overflow-hidden rounded-lg group relative bg-brand-light w-full cursor-pointer"
            // variants={{
            //   hidden: { opacity: 0, y: 20 },
            //   show: { opacity: 1, y: 0 },
            // }}
          >
            <Image
              src={item.asset?.url || ""}
              alt={item.alt || ""}
              fill
              className={cn("object-cover transition-transform duration-300 group-hover:scale-105")}
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {selectedIndex !== null && images[selectedIndex] && (
          <div className="fixed inset-0 z-50">
            <motion.button
              type="button"
              aria-label="Close gallery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 border-0 bg-brand-dark/80 backdrop-blur-sm p-0 cursor-default"
              onClick={close}
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
              <motion.button
                aria-label="Previous Image"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 text-white z-10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <ArrowLeft className="size-8" />
              </motion.button>
              <motion.button
                aria-label="Next Image"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 text-white z-10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <ArrowRight className="size-8" />
              </motion.button>

              <motion.div
                layoutId={`image-container-${images[selectedIndex].asset?._id || selectedIndex}`}
                className="relative w-full max-w-5xl aspect-[4/3] rounded-lg overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <AnimatePresence initial={false} custom={direction}>
                  <motion.div
                    key={selectedIndex}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                    }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={images[selectedIndex].asset?.url || ""}
                      alt={images[selectedIndex].alt || ""}
                      fill
                      sizes="(max-width: 1024px) 100vw, 1024px"
                      className="object-contain"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>

            <motion.button
              aria-label="Close"
              onClick={close}
              className="absolute top-4 right-4 text-white z-10 hover:scale-110"
            >
              <X className="size-8" />
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

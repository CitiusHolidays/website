"use client"

import {
    animate,
    AnimatePresence,
    motion,
    Transition,
    useTime,
    useTransform,
} from "motion/react"
import { useEffect, useRef, useState } from "react"

const Badge = ({ state, isSubmitting }) => {
    const badgeRef = useRef(null)

    useEffect(() => {
        if (!badgeRef.current) return

        if (state === "error") {
            animate(
                badgeRef.current,
                { x: [0, -6, 6, -6, 0] },
                {
                    duration: 0.3,
                    ease: "easeInOut",
                    times: [0, 0.25, 0.5, 0.75, 1],
                    repeat: 0,
                    delay: 0.1,
                }
            )
        } else if (state === "success") {
            animate(
                badgeRef.current,
                {
                    scale: [1, 1.2, 1],
                },
                {
                    duration: 0.3,
                    ease: "easeInOut",
                    times: [0, 0.5, 1],
                    repeat: 0,
                }
            )
        }
    }, [state])

    return (
        <motion.div
            ref={badgeRef}
            style={{ ...styles.badge, gap: state === "idle" ? 0 : 8 }}
            className="bg-citius-orange text-brand-light"
        >
            <Icon state={state} />
            <Label state={state} />
        </motion.div>
    )
}

const Icon = ({ state }) => {
    let IconComponent = <></>

    switch (state) {
        case "idle":
            IconComponent = <></>
            break
        case "processing":
            IconComponent = <Loader />
            break
        case "success":
            IconComponent = <Check />
            break
        case "error":
            IconComponent = <X />
            break
    }

    return (
        <motion.span
            style={styles.iconContainer}
            animate={{ width: state === "idle" ? 0 : 20 }}
            transition={SPRING_CONFIG}
        >
            <AnimatePresence>
                <motion.span
                    key={state}
                    style={styles.icon}
                    initial={{ y: -40, scale: 0.5, filter: "blur(6px)" }}
                    animate={{ y: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{ y: 40, scale: 0.5, filter: "blur(6px)" }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                >
                    {IconComponent}
                </motion.span>
            </AnimatePresence>
        </motion.span>
    )
}

const ICON_SIZE = 20
const STROKE_WIDTH = 2
const VIEW_BOX_SIZE = 24

const svgProps = {
    width: ICON_SIZE,
    height: ICON_SIZE,
    viewBox: `0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: STROKE_WIDTH,
    strokeLinecap: "round",
    strokeLinejoin: "round",
}

function Check() {
    return (
        <motion.svg {...svgProps}>
            <motion.polyline points="4 12 9 17 20 6" {...animations} />
        </motion.svg>
    )
}

function Loader() {
    const time = useTime()
    const rotate = useTransform(time, [0, 1000], [0, 360], { clamp: false })

    return (
        <motion.div
            style={{
                rotate,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: ICON_SIZE,
                height: ICON_SIZE,
            }}
        >
            <motion.svg {...svgProps}>
                <motion.path d="M21 12a9 9 0 1 1-6.219-8.56" {...animations} />
            </motion.svg>
        </motion.div>
    )
}

function X() {
    return (
        <motion.svg {...svgProps}>
            <motion.line x1="6" y1="6" x2="18" y2="18" {...animations} />
            <motion.line x1="18" y1="6" x2="6" y2="18" {...secondLineAnimation} />
        </motion.svg>
    )
}

const animations = {
    initial: { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: { type: "spring", stiffness: 150, damping: 20 },
}

const secondLineAnimation = {
    ...animations,
    transition: { ...animations.transition, delay: 0.1 },
}

const Label = ({ state }) => {
    const [labelWidth, setLabelWidth] = useState(0)
    const measureRef = useRef(null)

    useEffect(() => {
        if (measureRef.current) {
            const { width } = measureRef.current.getBoundingClientRect()
            setLabelWidth(width)
        }
    }, [state])

    return (
        <>
            <div
                ref={measureRef}
                style={{
                    position: "absolute",
                    visibility: "hidden",
                    whiteSpace: "nowrap",
                }}
            >
                {STATES[state]}
            </div>
            <motion.span
                layout
                style={{ position: "relative" }}
                animate={{ width: labelWidth }}
                transition={SPRING_CONFIG}
            >
                <AnimatePresence mode="sync" initial={false}>
                    <motion.div
                        key={state}
                        style={{ textWrap: "nowrap" }}
                        initial={{ y: -20, opacity: 0, filter: "blur(10px)", position: "absolute" }}
                        animate={{ y: 0, opacity: 1, filter: "blur(0px)", position: "relative" }}
                        exit={{ y: 20, opacity: 0, filter: "blur(10px)", position: "absolute" }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                        {STATES[state]}
                    </motion.div>
                </AnimatePresence>
            </motion.span>
        </>
    )
}

const styles = {
    badge: {
        display: "flex",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 20px",
        borderRadius: 999,
        willChange: "transform, filter",
        fontWeight: 600,
    },
    iconContainer: {
        height: 20,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    icon: {
        position: "absolute",
        left: 0,
        top: 0,
    },
}

const STATES = {
    idle: "Send Message",
    processing: "Sending...",
    success: "Sent!",
    error: "Failed! Try again",
}

const SPRING_CONFIG = {
    type: "spring",
    stiffness: 600,
    damping: 30,
}

export default function AnimatedSubmitButton({ state, isSubmitting }) {
    return (
        <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center"
        >
            <Badge state={state} />
        </button>
    )
} 
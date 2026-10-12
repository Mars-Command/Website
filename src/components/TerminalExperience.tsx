import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { sitePath } from "../config/account";
import { TerminalMotionContext as ExperienceContext } from "../hooks/useTerminalMotion";

export const PLANET_FADE_MS = 1500;

type SequenceEntry =
	| { kind: "text"; element: HTMLElement; length: () => number; show: (count: number | null) => void }
	| { kind: "box"; element: HTMLElement; duration: number; show: (visible: boolean) => void };
const SequenceContext = createContext<((entry: SequenceEntry) => () => void) | null>(null);
const ReplayContext = createContext(0);

function useReducedMotion() {
	const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
	useEffect(() => {
		const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
		if (!media) return;
		const update = () => setReduced(media.matches);
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	return reduced;
}

function useInstantMotion(animate: boolean) {
	const replayKey = useContext(ReplayContext);
	const [motion, setMotion] = useState({ replayKey, instant: !animate });
	if (motion.replayKey !== replayKey) setMotion({ replayKey, instant: !animate });
	else if (!animate && !motion.instant) setMotion({ replayKey, instant: true });
	return motion.replayKey === replayKey ? motion.instant : !animate;
}

export function PageExperience({ children, ready = true }: { children: ReactNode; ready?: boolean }) {
	const reduced = useReducedMotion();
	const [phase, setPhase] = useState<"loading" | "fading" | "content">("loading");
	const [pageLoaded, setPageLoaded] = useState(document.readyState === "complete");
	const [fontsLoaded, setFontsLoaded] = useState(!document.fonts);
	const [planetLoaded, setPlanetLoaded] = useState(false);
	const [planetError, setPlanetError] = useState(false);
	const [skipped, setSkipped] = useState(false);
	const beginNavigation = useCallback(() => { setSkipped(false); return !reduced; }, [reduced]);
	const [typingSequences, setTypingSequences] = useState<Set<symbol>>(() => new Set());
	const beginTyping = useCallback(() => {
		const token = Symbol();
		setTypingSequences(previous => new Set(previous).add(token));
		return () => setTypingSequences(previous => {
			if (!previous.has(token)) return previous;
			const next = new Set(previous);
			next.delete(token);
			return next;
		});
	}, []);
	const planet = useRef<HTMLImageElement>(null);

	useEffect(() => {
		let active = true;
		const loaded = () => setPageLoaded(true);
		window.addEventListener("load", loaded);
		if (document.readyState === "complete") loaded();
		if (document.fonts) void document.fonts.ready.then(() => { if (active) setFontsLoaded(true); });
		if (planet.current?.complete) {
			setPlanetLoaded(true);
			setPlanetError(planet.current.naturalWidth === 0);
		}
		return () => { active = false; window.removeEventListener("load", loaded); };
	}, []);

	useEffect(() => {
		if (phase === "loading" && pageLoaded && fontsLoaded && planetLoaded && ready) {
			if (reduced || skipped) {
				let active = true;
				queueMicrotask(() => { if (active) setPhase("content"); });
				return () => { active = false; };
			}
			const frame = requestAnimationFrame(() => setPhase("fading"));
			return () => cancelAnimationFrame(frame);
		}
		if (phase === "fading") {
			const timer = window.setTimeout(() => setPhase("content"), reduced || skipped ? 0 : PLANET_FADE_MS);
			return () => window.clearTimeout(timer);
		}
	}, [phase, pageLoaded, fontsLoaded, planetLoaded, ready, reduced, skipped]);

	useEffect(() => {
		if (phase === "content") return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => { document.body.style.overflow = previous; };
	}, [phase]);

	const entered = phase === "content";
	return <ExperienceContext value={{ entered, animate: !reduced && !skipped, beginTyping, beginNavigation }}>
		{!entered && <div className={`planet-loader planet-loader--${phase}`} data-phase={phase}
			onTransitionEnd={event => {
				if (phase === "fading" && event.target === event.currentTarget && event.propertyName === "opacity") setPhase("content");
			}}>
			<div className="planet-loader-art">
				<img ref={planet} src={sitePath("planet.png")} alt="Petrora Rubra, the Crowned"
					width={1024} height={1024} fetchPriority="high"
					onLoad={() => setPlanetLoaded(true)}
					onError={() => { setPlanetLoaded(true); setPlanetError(true); }} />
			</div>
			<p className="boot-wordmark">MARS<span> COMMAND</span></p>
			<p className="boot-status" role="progressbar" aria-label="Loading mission control"
				aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === "fading" ? 100 : 0}>
				<span className="boot-indicator" />{phase === "fading" ? "uplink ready // opening terminal" : "initialising colony uplink"}
			</p>
			{planetError && <p className="terminal-error" role="alert">Planet image unavailable. Opening mission control without it.</p>}
			<button className="skip-animation" onClick={() => setSkipped(true)} disabled={skipped}>
				{skipped ? "waiting for uplink..." : "Skip intro"}
			</button>
		</div>}
		<div className={`page-content${entered ? " is-entered" : ""}`} inert={!entered} aria-hidden={!entered}>
			{entered && planetError && <p className="asset-error terminal-error" role="alert">Planet image unavailable. Mission control is ready.</p>}
			{children}
			{entered && !reduced && !skipped && typingSequences.size > 0 && <button className="skip-animation skip-typing" onClick={() => setSkipped(true)}>
				Skip typing
			</button>}
		</div>
	</ExperienceContext>;
}

export function TerminalSequence({ children, onComplete, active = true, replayKey = 0 }:
	{ children: ReactNode; onComplete?: () => void; active?: boolean; replayKey?: number }) {
	const { entered, animate, beginTyping } = useContext(ExperienceContext);
	const lines = useRef(new Set<SequenceEntry>());
	const started = useRef(false);
	const finished = useRef(false);
	const replay = useRef(replayKey);
	const completion = useRef(onComplete);
	useLayoutEffect(() => { completion.current = onComplete; }, [onComplete]);
	const register = useCallback((line: SequenceEntry) => {
		lines.current.add(line);
		if (started.current) {
			if (line.kind === "box") line.show(true);
			else line.show(null);
		}
		return () => { lines.current.delete(line); };
	}, []);

	useLayoutEffect(() => {
		if (replay.current !== replayKey) { replay.current = replayKey; finished.current = false; }
		if (!entered || !active) return;
		started.current = true;
		const ordered = [...lines.current].sort((a, b) =>
			a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
		const finish = () => {
			if (finished.current) return;
			finished.current = true;
			completion.current?.();
		};
		if (!animate || finished.current) {
			ordered.forEach(line => { if (line.kind === "box") line.show(true); else line.show(null); });
			finish();
			return;
		}
		ordered.forEach(line => { if (line.kind === "box") line.show(false); else line.show(0); });
		const endTyping = beginTyping();
		let frame = 0;
		let index = 0;
		let start: number | null = null;
		const tick = (now: number) => {
			const line = ordered[index];
			if (!line) { endTyping(); finish(); return; }
			if (!lines.current.has(line)) { index++; start = null; frame = requestAnimationFrame(tick); return; }
			start ??= now;
			const duration = line.kind === "box" ? line.duration : Math.min(500, Math.max(100, line.length() * 9));
			const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
			if (line.kind === "box") line.show(true);
			else line.show(progress === 1 ? null : Math.floor(progress * line.length()));
			if (progress === 1) { index++; start = null; }
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => { cancelAnimationFrame(frame); endTyping(); };
	}, [entered, animate, beginTyping, active, replayKey]);

	return <SequenceContext value={register}><ReplayContext value={replayKey}>{children}</ReplayContext></SequenceContext>;
}

export function TerminalText({ children }: { children: string }) {
	const register = useContext(SequenceContext);
	const { animate } = useContext(ExperienceContext);
	const [count, setCount] = useState<number | null>(register && animate ? 0 : null);
	const element = useRef<HTMLSpanElement>(null);
	const source = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		if (!register || !element.current) return;
		return register({ kind: "text", element: element.current, length: () => source.current?.textContent?.length ?? 0, show: setCount });
	}, [register]);
	return <span ref={element} className={`typed-text${count === null ? " is-typed" : ""}`} data-type-line>
		<span ref={source} className="typed-source">{children}</span>
		{count !== null && <span className="typed-output" aria-hidden="true">
			{children.slice(0, count)}{count > 0 && <span className="typing-cursor" />}
		</span>}
	</span>;
}

export function TerminalBox({ as: Tag = "section", framed = true, children, className = "", ...props }:
	HTMLAttributes<HTMLElement> & { as?: "section" | "article"; framed?: boolean; children: ReactNode }) {
	const register = useContext(SequenceContext);
	const { animate } = useContext(ExperienceContext);
	const instant = useInstantMotion(animate);
	const [drawn, setDrawn] = useState(!register || !animate);
	const element = useRef<HTMLElement>(null);
	useLayoutEffect(() => {
		if (!register || !element.current) return;
		return register({ kind: "box", element: element.current, duration: framed ? 220 : 0, show: setDrawn });
	}, [register, framed]);
	return <Tag {...props} ref={element}
		className={`${className} terminal-box${framed ? " has-frame" : ""}${drawn ? " is-drawn" : ""}${instant ? " no-motion" : ""}`}
		inert={!drawn} aria-hidden={drawn ? props["aria-hidden"] : true}>
		{framed && <svg className="terminal-box-frame" aria-hidden="true">
			<rect width="100%" height="100%" pathLength="1" />
		</svg>}
		{children}
	</Tag>;
}

export function TerminalFade({ children, order = 0, className = "" }: { children: ReactNode; order?: number; className?: string }) {
	const { entered, animate } = useContext(ExperienceContext);
	const instant = useInstantMotion(animate);
	return <div className={`terminal-fade ${className}${entered ? " is-revealed" : ""}${instant ? " no-motion" : ""}`}
		style={{ "--reveal-delay": `${order * 110}ms` } as CSSProperties}>{children}</div>;
}

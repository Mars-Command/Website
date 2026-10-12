import { ArrowUpRight, Menu, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { marsConfig } from "../config/mars";
import { sitePath } from "../config/account";
import type { MissionView } from "../data/missionViews";
import { pulseTarget } from "../utils/pulseTarget";
import { MissionNavigation } from "./MissionNavigation";
import { StatusBadge } from "./StatusBadge";

type SiteHeaderProps = {
	online: boolean | null;
	checking: boolean;
	onHome?: () => void;
	activeView?: MissionView | null;
	onNavigate?: (view: MissionView) => void;
	mobileNavigation?: ReactNode;
	menuLabel?: string;
	state?: ReactNode;
	homeHref?: string;
};

export function SiteHeader({ online, checking, onHome, activeView = null, onNavigate, mobileNavigation,
	menuLabel = "mission", state, homeHref = "#top" }: SiteHeaderProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const menuId = useId();
	const header = useRef<HTMLElement>(null);
	const toggle = useRef<HTMLButtonElement>(null);
	const hasMenu = !!onNavigate || !!mobileNavigation;
	const closeMenu = useCallback((restoreFocus = false) => {
		setMenuOpen(false);
		if (restoreFocus) toggle.current?.focus({ preventScroll: true });
	}, []);
	useEffect(() => {
		if (!menuOpen) return;
		const dismissOutside = (event: Event) => {
			if (event.target instanceof Node && !header.current?.contains(event.target)) closeMenu();
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); closeMenu(true); }
		};
		const media = window.matchMedia?.("(max-width: 760px)");
		const resized = () => { if (media && !media.matches) closeMenu(); };
		document.addEventListener("pointerdown", dismissOutside);
		document.addEventListener("focusin", dismissOutside);
		document.addEventListener("keydown", escape);
		media?.addEventListener("change", resized);
		return () => {
			document.removeEventListener("pointerdown", dismissOutside);
			document.removeEventListener("focusin", dismissOutside);
			document.removeEventListener("keydown", escape);
			media?.removeEventListener("change", resized);
		};
	}, [menuOpen, closeMenu]);
	return (
		<header ref={header} className={`site-header${hasMenu ? " has-mobile-menu" : ""}`} id="top">
			<a className="skip-link" href="#main-content">Skip to content</a>
			<a
				className="brand-lockup"
				href={homeHref}
				aria-label="Mars Command home"
				onClick={event => {
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
					closeMenu();
					if (onHome) { event.preventDefault(); onHome(); }
					else pulseTarget("hero-panel");
				}}
			>
				<span className="brand-mark" aria-hidden="true">M<span>_</span>
				</span>
				<span className="brand-copy">
					<strong>MARS COMMAND</strong>
					<small>
						COLONY NETWORK /{" "}
						{marsConfig.serverName.toUpperCase()}
					</small>
				</span>
			</a>
			<div className="header-state">
				{state ?? <>
				<a className="header-account" href={sitePath("account")}>Account &amp; profiles <ArrowUpRight size={12} aria-hidden="true" /></a>
				<span className="header-channel">
					<span className="channel-dot" /> PUBLIC
					COMMS
				</span>
				<StatusBadge
					online={online}
					checking={checking}
				/>
				</>}
				{hasMenu && <button ref={toggle} type="button" className="header-menu-toggle"
					aria-label={`${menuOpen ? "Close" : "Open"} ${menuLabel} menu`}
					aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}>
					{menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
					<span>{menuOpen ? "Close" : "Menu"}</span>
				</button>}
			</div>
			{hasMenu && <div id={menuId} className="mobile-mission-menu" hidden={!menuOpen} onClick={event => {
				if (!mobileNavigation || !(event.target instanceof Element)) return;
				const control = event.target.closest("button, a");
				if (control) closeMenu(control.tagName === "BUTTON");
			}}>
				<p className="sidebar-label">{menuLabel === "mission" ? "MISSION FILES" : "ACCOUNT FILES"}</p>
				{mobileNavigation ?? (onNavigate && <>
				<MissionNavigation mobile activeView={activeView} onNavigate={view => {
					closeMenu(true);
					onNavigate(view);
				}} />
				<div className="mobile-account-links">
					<a href={sitePath("account")} onClick={() => closeMenu()}>Account dashboard <ArrowUpRight size={13} aria-hidden="true" /></a>
					<a href={sitePath("auth/login")} onClick={() => closeMenu()}>Sign in <ArrowUpRight size={13} aria-hidden="true" /></a>
				</div>
				</>)}
			</div>}
		</header>
	);
}

import { ArrowDown, ArrowUpRight } from "lucide-react";
import { TerminalText } from "./TerminalExperience";

type HeroPanelProps = { online: boolean | null; checking: boolean };

export function HeroPanel({ online, checking }: HeroPanelProps) {
	return <section className="hero-panel" id="hero-panel" aria-labelledby="hero-title">
		<p className="terminal-prompt"><span>visitor@mars</span>:<b>~</b>$ <TerminalText>cat welcome.txt</TerminalText></p>
		<div className="hero-meta"><span className="eyebrow"><TerminalText>WELCOME TO THE RED PLANET</TerminalText></span>
			<span className="signal-caption">SIGNAL {checking ? "ACQUIRING" : online ? "LOCKED" : "LOST"}</span>
		</div>
		<h1 id="hero-title"><TerminalText>Not just a server.</TerminalText><br /><span><TerminalText>A new world.</TerminalText></span></h1>
		<p className="hero-subtitle"><TerminalText>The red planet has chosen you. Your next chapter starts here.</TerminalText></p>
		<p className="hero-aside"><TerminalText>Build a colony. Find your people. Do not ask why the moon is watching.</TerminalText></p>
		<div className="hero-links">
			<a className="hero-jump" href="#launcher-panel"><TerminalText>Begin your mission</TerminalText><ArrowUpRight size={15} aria-hidden="true" /></a>
			<a href="#server-status"><TerminalText>Check the uplink</TerminalText><ArrowDown size={13} aria-hidden="true" /></a>
		</div>
	</section>;
}

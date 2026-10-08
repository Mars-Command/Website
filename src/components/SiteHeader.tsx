import { RadioTower } from "lucide-react";
import { marsConfig } from "../config/mars";
import { sitePath } from "../config/account";
import { pulseTarget } from "../utils/pulseTarget";
import { StatusBadge } from "./StatusBadge";

type SiteHeaderProps = {
	online: boolean | null;
	checking: boolean;
};

export function SiteHeader({ online, checking }: SiteHeaderProps) {
	return (
		<header className="site-header" id="top">
			<a
				className="brand-lockup"
				href="#top"
				aria-label="Mars Command home"
				onClick={() => pulseTarget("hero-panel")}
			>
				<span className="brand-mark">
					<RadioTower
						size={19}
						aria-hidden="true"
					/>
				</span>
				<span className="brand-copy">
					<strong>MARS COMMAND</strong>
					<small>
						COLONY NETWORK //{" "}
						{marsConfig.serverName.toUpperCase()}
					</small>
				</span>
			</a>
			<div className="header-state">
				<a href={sitePath("account")}>Account &amp; profiles</a>
				<span className="header-channel">
					<span className="channel-dot" /> PUBLIC
					COMMS
				</span>
				<StatusBadge
					online={online}
					checking={checking}
				/>
			</div>
		</header>
	);
}

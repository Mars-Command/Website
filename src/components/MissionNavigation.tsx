import { ChevronRight } from "lucide-react";
import { missionViews } from "../data/missionViews";
import type { MissionView } from "../data/missionViews";
import { TerminalFade } from "./TerminalExperience";

type TerminalNavigationProps<View extends string> = {
	items: readonly { id: View; label: string }[];
	activeView: View | null;
	onNavigate: (view: View) => void;
	mobile?: boolean;
	label?: string;
};

export function TerminalNavigation<View extends string>({ items, activeView, onNavigate, mobile = false, label = "Mission control" }: TerminalNavigationProps<View>) {
	return <nav className={mobile ? "mobile-directory-nav" : "directory-nav"}
		aria-label={mobile ? `Mobile ${label.toLowerCase()}` : label}>
		{items.map((item, index) => {
			const button = <button key={item.id} type="button" onClick={() => onNavigate(item.id)}
				aria-current={activeView === item.id ? "page" : undefined} aria-controls="main-content">
				<span>{String(index + 1).padStart(2, "0")}</span>{item.label}<ChevronRight size={12} aria-hidden="true" />
			</button>;
			return mobile ? button : <TerminalFade key={item.id} order={index + 1}>{button}</TerminalFade>;
		})}
	</nav>;
}

export function MissionNavigation(props: Omit<TerminalNavigationProps<MissionView>, "items">) {
	return <TerminalNavigation {...props} items={missionViews} />;
}

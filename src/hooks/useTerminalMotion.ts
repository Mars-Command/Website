import { createContext, useContext } from "react";

type TerminalMotion = {
	entered: boolean;
	animate: boolean;
	beginTyping: () => () => void;
	beginNavigation: () => boolean;
};

export const TerminalMotionContext = createContext<TerminalMotion>({
	entered: true, animate: false, beginTyping: () => () => {}, beginNavigation: () => false,
});

export function useTerminalMotion() {
	return useContext(TerminalMotionContext);
}

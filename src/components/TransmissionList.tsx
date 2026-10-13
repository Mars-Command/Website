import { AlertTriangle, Check, Info } from "lucide-react";
import { transmissions } from "../data/transmissions";
import { TerminalBox, TerminalText } from "./TerminalExperience";

const severityIcon = {
	warning: AlertTriangle,
	info: Info,
	success: Check,
} as const;

export function TransmissionList() {
	return (
		<TerminalBox
			framed={false}
			className="transmission-section"
			id="transmissions"
			aria-labelledby="transmissions-heading"
		>
			<div className="section-title-row">
				<div>
					<p className="eyebrow">
						<TerminalText>
							03 / RELEASE UPDATES
						</TerminalText>
					</p>
					<h2 id="transmissions-heading">
						<TerminalText>
							LATEST TRANSMISSIONS
						</TerminalText>
					</h2>
				</div>
				<span className="transmission-count">
					<TerminalText>{`${String(
						transmissions.length,
					).padStart(
						2,
						"0",
					)} UPDATES`}</TerminalText>
				</span>
			</div>
			<div className="transmission-list">
				{transmissions.map((transmission, index) => {
					const Icon =
						severityIcon[
							transmission.severity
						];
					return (
						<TerminalBox
							as="article"
							className={`transmission transmission--${transmission.severity}`}
							key={transmission.title}
						>
							<span className="transmission-index">
								<TerminalText>
									{String(
										index +
											1,
									).padStart(
										2,
										"0",
									)}
								</TerminalText>
							</span>
							<Icon
								size={17}
								className="transmission-icon"
								aria-hidden="true"
							/>
							<div>
								<h3>
									<TerminalText>
										{
											transmission.title
										}
									</TerminalText>
								</h3>
								<p>
									<TerminalText>
										{
											transmission.body
										}
									</TerminalText>
								</p>
							</div>
						</TerminalBox>
					);
				})}
			</div>
		</TerminalBox>
	);
}

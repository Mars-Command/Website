import { marsConfig } from "../config/mars";
import { accountConfig } from "../config/account";

export function SiteFooter() {
	return (
		<footer className="site-footer">
			<p>
				<span>MARS COMMAND</span> // COLONY NETWORK
			</p>
			<p>
				Atmospheric safety: <strong>UNVERIFIED</strong>
				<span className="footer-divider">·</span>{" "}
				Terraforming progress: <strong>0.00%</strong>
			</p>
			<p className="footer-moon">
				The moon has been informed //{" "}
				{marsConfig.serverAddress}
			</p>
			<p>{accountConfig.sponsorsUrl ?
				<a href={accountConfig.sponsorsUrl} target="_blank" rel="noopener noreferrer">Support Mars Command on GitHub Sponsors</a> :
				"Donations unavailable // recipient not configured"}</p>
		</footer>
	);
}

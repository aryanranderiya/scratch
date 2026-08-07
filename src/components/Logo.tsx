export function Logo({ size = 22, className }: { size?: number; className?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 32 32"
			fill="none"
			role="img"
			aria-label="Scratch"
			className={className}
		>
			<defs>
				<linearGradient id="scratch-logo-grad" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#0A84FF" />
					<stop offset="1" stopColor="#7B5CFF" />
				</linearGradient>
			</defs>
			<rect
				x="2"
				y="2"
				width="28"
				height="28"
				rx="8"
				fill="url(#scratch-logo-grad)"
				opacity="0.16"
			/>
			<path
				d="M9 10.5C9 8.57 10.57 7 12.5 7c1.5 0 2.7 1 3.1 2.4l4.8 13.2c.4 1.4 1.6 2.4 3.1 2.4"
				stroke="url(#scratch-logo-grad)"
				strokeWidth="2.4"
				strokeLinecap="round"
			/>
			<circle cx="10" cy="20.5" r="2" fill="url(#scratch-logo-grad)" />
		</svg>
	);
}

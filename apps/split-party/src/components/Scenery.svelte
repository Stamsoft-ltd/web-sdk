<svg
	class="scenery"
	viewBox="0 0 1600 1000"
	preserveAspectRatio="xMidYMid slice"
	aria-hidden="true"
>
	<defs>
		<linearGradient id="sky" x2="0" y2="1"
			><stop stop-color="#44baf7" /><stop offset=".7" stop-color="#a4e6ff" /><stop
				offset="1"
				stop-color="#eed0ff"
			/></linearGradient
		>
		<linearGradient id="ground" x2="0" y2="1"
			><stop stop-color="#ffc2a2" /><stop offset="1" stop-color="#f581e0" /></linearGradient
		>
		<linearGradient id="cliff" x2=".8" y2="1"
			><stop stop-color="#9997ed" /><stop offset="1" stop-color="#675adb" /></linearGradient
		>
		<linearGradient id="grass" x2=".3" y2="1"
			><stop stop-color="#beff79" /><stop offset="1" stop-color="#2bd1ac" /></linearGradient
		>
		<filter id="soft"><feGaussianBlur stdDeviation="8" /></filter>
	</defs>
	<rect width="1600" height="1000" fill="url(#sky)" />
	<g fill="white" opacity=".5" filter="url(#soft)"
		><ellipse cx="180" cy="100" rx="230" ry="66" /><ellipse
			cx="120"
			cy="55"
			rx="78"
			ry="75"
		/><ellipse cx="1460" cy="168" rx="270" ry="66" /><ellipse
			cx="1510"
			cy="100"
			rx="130"
			ry="90"
		/></g
	>
	<g fill="#80b7f3" opacity=".8"
		><path d="M0 700Q70 120 170 365T390 330Q500 300 540 750Z" /><path
			d="M1100 750Q1150 260 1250 300T1390 250Q1500 90 1620 500V800Z"
		/></g
	>
	<path d="M0 697Q400 654 830 710T1600 677V1000H0Z" fill="url(#ground)" />
	<g filter="url(#soft)"
		><path d="M-50 700V310Q110 190 220 320L283 710Z" fill="url(#cliff)" /><path
			d="M-40 331Q100 195 228 323L223 379Q95 296-25 385Z"
			fill="url(#grass)"
		/>
		<path
			d="M-20 673Q20 383 115 380Q217 378 225 673L179 680Q155 466 117 470Q65 480 51 700Z"
			fill="url(#grass)"
		/>
		<path d="M1330 751Q1310 360 1650 318V778Z" fill="url(#cliff)" /><path
			d="M1340 442Q1380 344 1610 313L1635 381Q1430 390 1355 482Z"
			fill="url(#grass)"
		/>
		<path d="M1150 782Q1112 596 1350 572L1400 800Z" fill="url(#cliff)" /><ellipse
			cx="1274"
			cy="580"
			rx="132"
			ry="32"
			fill="url(#grass)"
		/>
		<path d="M260 665 278 470 433 477 458 703Z" fill="url(#cliff)" /><ellipse
			cx="360"
			cy="470"
			rx="105"
			ry="27"
			fill="url(#grass)"
		/>
		<path d="M1450 361v-113" stroke="#b898d9" stroke-width="30" /><ellipse
			cx="1455"
			cy="236"
			rx="72"
			ry="59"
			fill="#ffb447"
		/>
		<ellipse cx="233" cy="752" rx="78" ry="53" fill="#e26be6" /><ellipse
			cx="71"
			cy="768"
			rx="48"
			ry="25"
			fill="#64a7f2"
		/>
		<ellipse cx="1323" cy="886" rx="130" ry="53" fill="#a879ed" /><ellipse
			cx="1610"
			cy="917"
			rx="180"
			ry="135"
			fill="#8865e9"
		/>
		<ellipse cx="-60" cy="975" rx="255" ry="135" fill="#3ed8b0" /><ellipse
			cx="332"
			cy="1008"
			rx="160"
			ry="64"
			fill="#55e5c1"
		/>
	</g>
	<g fill="white" opacity=".45"
		><circle cx="235" cy="310" r="4" /><circle cx="1430" cy="495" r="5" /><circle
			cx="117"
			cy="560"
			r="3"
		/><circle cx="1500" cy="615" r="3" /></g
	>
</svg>

<style>
	.scenery {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
		pointer-events: none;
	}
</style>

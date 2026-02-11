<svelte:head>
	<title>Market Data - Real Estate Analytics Dashboard</title>
</svelte:head>

<main class="min-h-screen bg-[#0c0c0c] overflow-hidden flex flex-col">
	<!-- Background Effects -->
	<div class="fixed inset-0 pointer-events-none">
		<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#d4a853]/5 rounded-full blur-[120px]"></div>
		<div class="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#d4a853]/3 rounded-full blur-[100px]"></div>
	</div>

	<!-- Navigation -->
	<nav class="relative z-10 bg-gradient-to-r from-[#141414]/95 via-[#1a1a1a]/90 to-[#141414]/95 backdrop-blur-xl border-b border-[#d4a853]/10 shadow-lg shadow-black/20">
		<div class="absolute inset-0 bg-gradient-to-r from-[#d4a853]/[0.02] via-transparent to-[#d4a853]/[0.02]"></div>
		<div class="max-w-6xl mx-auto px-6 lg:px-8 relative">
			<div class="flex items-center justify-between h-20">
				<a href="/" class="flex items-center gap-3 group">
					<div class="w-9 h-9 rounded-lg bg-gradient-to-br from-[#d4a853] to-[#b8903e] flex items-center justify-center shadow-lg shadow-[#d4a853]/20 group-hover:shadow-[#d4a853]/30 transition-shadow">
						<span class="text-[#0a0a0a] text-xs font-bold tracking-tight translate-x-[1px]">MD</span>
					</div>
					<span class="text-[#fafafa] text-sm font-medium tracking-wide">Market Data</span>
				</a>
				<a href="/dashboard" class="btn-primary">
					Go to Dashboard
				</a>
			</div>
		</div>
	</nav>

	<!-- Hero -->
	<div class="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-20 pb-24">
		<div class="max-w-3xl">
			<div class="inline-flex items-center gap-2 px-3 py-1.5 bg-[#d4a853]/10 border border-[#d4a853]/20 rounded-full mb-8">
				<span class="w-1.5 h-1.5 rounded-full bg-[#d4a853] animate-pulse"></span>
				<span class="text-[#d4a853] text-xs font-medium tracking-wide">Built for Real Estate Professionals</span>
			</div>

			<h1 class="text-[#fafafa] mb-6 leading-[1.1]">
				Market intelligence,<br />
				<span class="text-gradient-gold">beautifully presented.</span>
			</h1>

			<p class="text-[#787878] text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
				Upload your MLS reports, visualize market trends, and share stunning dashboards with your clients.
			</p>

			<div class="flex flex-wrap gap-3">
				<a href="/dashboard" class="btn-primary">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
					Go to Dashboard
				</a>
				<a href="/upload" class="btn-secondary">
					Upload Report
				</a>
			</div>
		</div>
	</div>

	<!-- Features -->
	<div class="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pb-24">
		<div class="grid md:grid-cols-3 gap-4">
			<!-- Upload -->
			<div class="group relative bg-gradient-to-b from-[#141414] to-[#101010] border border-[#1f1f1f] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:border-[#282828] hover:-translate-y-1">
				<div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4a853]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
				<div class="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#242424] flex items-center justify-center mb-5 group-hover:border-[#d4a853]/30 group-hover:bg-[#d4a853]/5 transition-colors">
					<svg class="w-5 h-5 text-[#d4a853]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
				</div>
				<h3 class="text-lg text-[#fafafa] mb-2">Upload Reports</h3>
				<p class="text-[#606060] text-sm leading-relaxed">
					Import your MLS data from Excel or CSV files with automatic metric extraction.
				</p>
			</div>

			<!-- Visualize -->
			<div class="group relative bg-gradient-to-b from-[#141414] to-[#101010] border border-[#1f1f1f] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:border-[#282828] hover:-translate-y-1">
				<div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4a853]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
				<div class="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#242424] flex items-center justify-center mb-5 group-hover:border-[#d4a853]/30 group-hover:bg-[#d4a853]/5 transition-colors">
					<svg class="w-5 h-5 text-[#d4a853]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
				</div>
				<h3 class="text-lg text-[#fafafa] mb-2">Visualize Trends</h3>
				<p class="text-[#606060] text-sm leading-relaxed">
					See price trends, inventory levels, and market conditions in interactive charts.
				</p>
			</div>

			<!-- Share -->
			<div class="group relative bg-gradient-to-b from-[#141414] to-[#101010] border border-[#1f1f1f] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:border-[#282828] hover:-translate-y-1">
				<div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4a853]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
				<div class="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#242424] flex items-center justify-center mb-5 group-hover:border-[#d4a853]/30 group-hover:bg-[#d4a853]/5 transition-colors">
					<svg class="w-5 h-5 text-[#d4a853]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
					</svg>
				</div>
				<h3 class="text-lg text-[#fafafa] mb-2">Share with Clients</h3>
				<p class="text-[#606060] text-sm leading-relaxed">
					Generate shareable links to give your clients instant access to market insights.
				</p>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<footer class="relative z-10 border-t border-[#1a1a1a]/50 mt-auto">
		<div class="max-w-6xl mx-auto px-6 lg:px-8 py-8">
			<div class="flex flex-col md:flex-row items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<div class="w-6 h-6 rounded-md bg-gradient-to-br from-[#d4a853] to-[#b8903e] flex items-center justify-center">
						<span class="text-[#0a0a0a] text-[8px] font-bold translate-x-[1px]">MD</span>
					</div>
					<span class="text-[#505050] text-xs">Market Data</span>
				</div>
				<p class="text-[#404040] text-xs">
					© {new Date().getFullYear()} Market Data. All rights reserved.
				</p>
			</div>
		</div>
	</footer>
</main>

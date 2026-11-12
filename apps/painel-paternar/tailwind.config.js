/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    // As telas do SDK (`*-ui`) trazem classes do Tailwind no bundle delas.
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}", "./node_modules/@adatechnology/*-ui/dist/**/*.js"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		/*
  		 * Fonte da marca: BETM Rounded (licenca paga). Enquanto os arquivos nao
  		 * estao no repo, entra a Nunito, tambem arredondada e embutida no bundle.
  		 * Ao receber os .woff2, declarar o @font-face em index.css e pronto.
  		 */
  		fontFamily: {
  			sans: ['"BETM Rounded"', '"Nunito Variable"', 'Nunito', 'ui-rounded', 'system-ui', 'sans-serif']
  		},
  		colors: {
  			/*
  			 * Paleta da marca (feedback do design, nov/2026): menos fria, mais
  			 * acolhedora. Em vez de trocar classe por classe em 30 telas, as
  			 * escalas que o app ja usa passam a apontar para a marca:
  			 *   zinc  -> neutros quentes, CLAROS no fundo (950 = off-white) e
  			 *            marinho no texto (100-200 = #2F2F51)
  			 *   blue  -> laranja da marca (#F28800 no 500)
  			 *   amber -> amarelo da marca
  			 * Quem precisar da cor da marca pelo nome usa `brand.*`.
  			 */
  			brand: {
  				orange: '#F28800',
  				yellow: '#FFC21A',
  				navy: '#2F2F51',
  				cream: '#F6F5F0'
  			},
  			zinc: {
  				50: '#1E1E38',
  				100: '#26264A',
  				200: '#2F2F51',
  				300: '#45446A',
  				400: '#5E5D7E',
  				500: '#76758F',
  				600: '#A3A2B5',
  				700: '#D6D2C6',
  				800: '#E9E5DB',
  				900: '#FFFFFF',
  				950: '#F6F5F0'
  			},
  			blue: {
  				50: '#FFF5E6',
  				100: '#FFE8C7',
  				200: '#FFD394',
  				300: '#FFB65A',
  				400: '#F99D26',
  				500: '#F28800',
  				600: '#D06F00',
  				700: '#A85800',
  				800: '#804300',
  				900: '#5C3000',
  				950: '#3A1E00'
  			},
  			amber: {
  				50: '#FFFAE8',
  				100: '#FFF1C2',
  				200: '#FFE38A',
  				300: '#FFD24D',
  				400: '#FFC21A',
  				500: '#F5AB00',
  				600: '#D69200',
  				700: '#A06C00',
  				800: '#7A5200',
  				900: '#5C3E00',
  				950: '#3A2700'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
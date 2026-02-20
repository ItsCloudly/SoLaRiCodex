import { createSignal, onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Film, Tv, Music, Search, Activity, Settings, Home, MonitorPlay, Wifi, BatteryFull, Smartphone } from "lucide-solid";

const apps = [
    { href: "/", icon: Home, label: "Overview", color: "#3b82f6" },
    { href: "/movies", icon: Film, label: "Films", color: "#ef4444" },
    { href: "/tv", icon: Tv, label: "Series", color: "#a855f7" },
    { href: "/music", icon: Music, label: "Music", color: "#eab308" },
    { href: "/player", icon: MonitorPlay, label: "Player", color: "#22c55e" },
    { href: "/search", icon: Search, label: "Discover", color: "#6366f1" },
    { href: "/activity", icon: Activity, label: "Queue", color: "#ec4899" },
    { href: "/settings", icon: Settings, label: "Config", color: "#6b7280" },
];

export default function SmartphoneHUD() {
    const [isOpen, setIsOpen] = createSignal(false);
    const [currentTime, setCurrentTime] = createSignal("");
    const navigate = useNavigate();

    const togglePhone = () => setIsOpen(!isOpen());

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab' || e.key.toLowerCase() === 'p') {
            e.preventDefault();
            togglePhone();
        }
    };

    onMount(() => {
        window.addEventListener('keydown', handleKeyDown);
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 1000);
        setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        onCleanup(() => {
            window.removeEventListener('keydown', handleKeyDown);
            clearInterval(timer);
        });
    });

    return (
        <div class={`smartphone-hud-container ${isOpen() ? 'open' : ''}`}>
            {/* Hint overlay when closed */}
            <div class={`smartphone-hint ${isOpen() ? 'hide' : ''}`} onClick={togglePhone}>
                <div class="hint-icon">
                    <Smartphone size={24} />
                </div>
                <div class="hint-text">
                    <span class="hint-time">{currentTime()}</span>
                    <span>Press [Tab] for Apps</span>
                </div>
            </div>

            {/* Phone Body */}
            <div class="smartphone-body">
                {/* Screen */}
                <div class="smartphone-screen">
                    {/* Status Bar */}
                    <div class="smartphone-status-bar">
                        <span class="status-time">{currentTime()}</span>
                        <div class="status-icons">
                            <Wifi size={14} />
                            <BatteryFull size={14} />
                        </div>
                    </div>

                    {/* App Grid */}
                    <div class="smartphone-app-grid">
                        {apps.map((app) => {
                            const Icon = app.icon;
                            return (
                                <button
                                    class="smartphone-app"
                                    onClick={() => {
                                        setIsOpen(false);
                                        navigate(app.href);
                                    }}
                                >
                                    <div class="app-icon" style={{ "background-color": app.color }}>
                                        <Icon size={26} color="white" />
                                    </div>
                                    <span class="app-label">{app.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Home Button / Swipe Indicator */}
                    <button class="smartphone-home-btn" onClick={togglePhone} title="Close PDA">
                        <div class="home-bar"></div>
                    </button>
                </div>
            </div>
        </div>
    );
}

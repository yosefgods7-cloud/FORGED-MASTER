/**
 * Sidebar Navigation Manager
 * Handles collapsible sidebar with touch/swipe support
 */

class SidebarManager {
    constructor() {
        this.isExpanded = false;
        this.isMobile = window.innerWidth <= 768;
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkMobileState();
        
        // Listen for window resize
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;
            
            if (wasMobile !== this.isMobile) {
                this.handleResponsiveChange();
            }
        });
    }

    setupEventListeners() {
        // Toggle button click
        const toggleBtn = document.getElementById('sidebarToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }

        // Navigation item clicks
        document.querySelectorAll('.sidebar-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tab = item.dataset.tab;
                if (tab) {
                    this.handleNavigation(tab);
                }
            });
        });

        // Touch events for swipe
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });

        // Swipe handle click
        const swipeHandle = document.querySelector('.swipe-handle');
        if (swipeHandle) {
            swipeHandle.addEventListener('click', () => this.toggle());
        }
    }

    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        
        // Check if touching from left edge (for opening)
        if (this.touchStartX < 20 && this.isMobile) {
            this.isOpeningSwipe = true;
        }
    }

    handleTouchEnd(e) {
        this.touchEndX = e.changedTouches[0].clientX;
        
        if (this.isOpeningSwipe) {
            const swipeDistance = this.touchEndX - this.touchStartX;
            
            if (swipeDistance > 50) {
                this.expand();
            } else if (swipeDistance < -50 && this.isExpanded) {
                this.collapse();
            }
            
            this.isOpeningSwipe = false;
        } else if (this.isMobile && this.isExpanded) {
            const swipeDistance = this.touchStartX - this.touchEndX;
            
            // Swipe left to close
            if (swipeDistance > 50) {
                this.collapse();
            }
        }
    }

    toggle() {
        if (this.isExpanded) {
            this.collapse();
        } else {
            this.expand();
        }
    }

    expand() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        
        if (this.isMobile) {
            sidebar.classList.add('mobile-expanded');
        }
        
        this.isExpanded = true;
        localStorage.setItem('sidebarExpanded', 'true');
    }

    collapse() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        sidebar.classList.remove('expanded', 'mobile-expanded');
        sidebar.classList.add('collapsed');
        
        this.isExpanded = false;
        localStorage.setItem('sidebarExpanded', 'false');
    }

    handleNavigation(tab) {
        // Navigate to the tab
        if (window.app) {
            app.navigate(tab);
        }

        // Auto-collapse on mobile after selection
        if (this.isMobile) {
            setTimeout(() => this.collapse(), 150);
        }

        // Update active state
        this.updateActiveState(tab);
    }

    updateActiveState(activeTab) {
        document.querySelectorAll('.sidebar-nav-item').forEach(item => {
            if (item.dataset.tab === activeTab) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Also update any legacy nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.tab === activeTab) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    checkMobileState() {
        const savedState = localStorage.getItem('sidebarExpanded');
        
        if (this.isMobile) {
            // On mobile, start collapsed by default
            this.collapse();
        } else {
            // On desktop, restore saved state or expand
            if (savedState === 'true') {
                this.expand();
            } else {
                this.collapse();
            }
        }
    }

    handleResponsiveChange() {
        if (!this.isMobile) {
            // Switching from mobile to desktop
            document.getElementById('sidebar')?.classList.remove('mobile-expanded');
            this.checkMobileState();
        }
    }

    // Programmatic navigation
    navigateTo(tab) {
        this.handleNavigation(tab);
    }
}

// Initialize when DOM is ready
let sidebarManager = null;

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        sidebarManager = new SidebarManager();
        window.sidebarManager = sidebarManager;
    });
}

if (typeof window !== 'undefined') {
    window.SidebarManager = SidebarManager;
}

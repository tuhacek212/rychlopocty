export class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.params = {};
        
        window.addEventListener('popstate', (e) => {
            this.handleRoute(window.location.pathname);
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                this.navigate(e.target.getAttribute('href'));
            }
        });
    }

    addRoute(path, handler) {
        this.routes[path] = handler;
    }

    navigate(path, replaceState = false) {
        if (replaceState) {
            window.history.replaceState({}, '', path);
        } else {
            window.history.pushState({}, '', path);
        }
        this.handleRoute(path);
    }

    handleRoute(path) {
        this.currentRoute = path;
        this.params = {};
        
        if (this.routes[path]) {
            this.routes[path](this.params);
            return;
        }
        
        for (const route in this.routes) {
            const pattern = route.replace(/:\w+/g, '([^/]+)');
            const regex = new RegExp('^' + pattern + '$');
            const match = path.match(regex);
            
            if (match) {
                const paramNames = route.match(/:\w+/g) || [];
                paramNames.forEach((name, i) => {
                    this.params[name.slice(1)] = match[i + 1];
                });
                this.routes[route](this.params);
                return;
            }
        }
        
        this.navigate('/', true);
    }

    start() {
        this.handleRoute(window.location.pathname);
    }
}
import connect from "./start.js";

interface Page {
    name: string;
    href: string;
    content: string;
}

interface NavigationModule {
    pages: Page[];
    loadPage: (href: string, pushToHistory: boolean) => void;
    fetchPage: (href: string, pageName: string) => Promise<Number>;
    init: () => void;
}

const navigationModule: NavigationModule = {
    pages: [],
    loadPage: function (href, pushToHistory) {
        const mainSection = document.querySelector('main');
        const wantedPage = this.pages.find((page: Page) => page.name === href);
        if (wantedPage && mainSection) {
            mainSection.innerHTML = wantedPage.content;
            if (pushToHistory)
                window.history.pushState({}, '', wantedPage.href);
        } else {
            if (mainSection)
                mainSection.innerHTML = '<h1>404 - Page not found</h1>';
            else
                console.error('Main section not found');
        }

        if (href === '/') {
            connect();
        }

    },
    fetchPage: function (href, pageName) {
        return fetch(href)
            .then(response => response.text())
            .then(content => this.pages.push({ name: pageName, href: href, content: content }));
    },
    init: function () {
        return Promise.all([
            this.fetchPage('/html/start.html', '/'),
            this.fetchPage('/html/chat.html', '/chat')
        ]).then(() => {
            this.loadPage(window.location.pathname, false);
            window.addEventListener('popstate', () => this.loadPage(window.location.pathname, false));
        });
    }
};

navigationModule.init();

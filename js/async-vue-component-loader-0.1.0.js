class AsyncVueComponentLoader {
    static ignoreAsyncElements() {
        Vue.config.ignoredElements.push(/async$/);
    }

    loadVueFiles(files) {
        files.forEach(file => this.loadVueFile(file));
    }

    loadVueFile(file) {
        fetch(file)
            .then(response => response.text())
            .then(data => {
                const dataElement = this._createElement('div', data);
                this._registerElement(this._createTemplateElement(dataElement));
                this._registerElement(this._createJavascriptElement(dataElement));
            });
    }

    _createTemplateElement(dataElement) {
        const element = this._createElement(
            'div',
            dataElement.querySelector('script[type="text/x-template"]')?.outerHTML
        );

        return element.firstChild;
    }

    _createJavascriptElement(dataElement) {
        return this._createElement(
            'script',
            dataElement.querySelector('script[type="application/javascript"]')?.innerHTML
        );
    }

    _registerElement(element) {
        document.body.appendChild(element);
    }

    _createElement(tag, html) {
        const element = document.createElement(tag);
        element.innerHTML = html;

        return element;
    }
}

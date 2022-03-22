class AsyncVueComponentLoader {
    static async load(entrypoint, container = {}, cacheEnabled = false) {
        const componentLoader = new AsyncVueComponentLoader(container, cacheEnabled);
        await componentLoader.loadComponent(entrypoint);

        return componentLoader;
    }

    constructor(container = {}, cacheEnabled = false) {
        this._container = container;
        this._cacheEnabled = cacheEnabled;
        this._loadedComponents = {};
    }

    async loadComponent(path) {
        if (/^[.\/]/.test(path) && this._getFileExtension(path) === '') {
            path += '.js';
        }

        if (this._loadedComponents[path]) {
            return this._loadedComponents[path];
        }

        if (this._container[path]) {
            return this._container[path];
        }

        const capitalizedKey = this._upperCaseFirstLetter(path);
        if (this._container[capitalizedKey]) {
            return this._container[capitalizedKey];
        }

        const component = await this.compileComponent(path);
        this._loadedComponents[path] = component;

        return component;
    }

    async compileComponent(path) {
        const data = await this._fetchData(path);
        const extension = this._getFileExtension(path);

        let component;
        if (extension === 'vue') {
            const { scriptContent, styleElement, templateContent } = this._extractVueComponent(path, data);
            const factory = this._createComponentCreatorFactory(path, scriptContent);

            component = await factory(this);
            if (!component.template && templateContent) {
                component.template = templateContent;
            }
            if (styleElement.innerHTML) {
                component.template = `<component is="style" type="text/css">${styleElement.innerHTML}</component>`
                    + `${component.template}`;
            }
        } else {
            const factory = this._createComponentCreatorFactory(path, data);
            component = await factory(this);
        }

        return component;
    }

    handleError(error) {
        console.error(error.message);
        console.error(error.stack);
    }

    _createComponentCreatorFactory(path, code) {
        const transpiledCode = this._transpileCode(path, code);
        const factoryCode = this._wrapWithFunction(transpiledCode);

        try {
            return eval(factoryCode);
        } catch (e) {
            e.message += ` (${path})`;
            this.handleError(e);

            throw e;
        }
    }

    _extractVueComponent(path, data) {
        const wrapperElement = this._createElement('div', data);
        const styleElement = this._extractStyleElement(wrapperElement);
        const templateContent = this._extractTemplate(wrapperElement);
        const scriptContent = this._extractScript(path, wrapperElement);

        return { wrapperElement, styleElement, templateContent, scriptContent };
    }

    _extractStyleElement(wrapperElement) {
        return wrapperElement.querySelector('style') || this._createElement('style');
    }

    _extractTemplate(wrapperElement) {
        const element = wrapperElement.querySelector('template');

        if (!element) {
            return '';
        }

        return element.innerHTML;
    }

    _extractScript(path, wrapperElement) {
        const scriptElement = wrapperElement.querySelector('script');

        if (!scriptElement) {
            return 'export default {}';
        }

        return scriptElement.innerHTML;
    }

    _createElement(tag, html = '') {
        const element = document.createElement(tag);
        element.innerHTML = html;

        return element;
    }

    _transpileCode(currentPath, code) {
        const pathsWithoutFileName = this._getPathArray(currentPath)
            .slice(0, -1)
            .filter(path => path !== '');

        const transpiledCode = code
            .replace(/export default/g, 'return')
            .replace(/import ([\s\S]*?) from (.*);/g, (matches, variableName, path) => {
                const pathWithoutQuotes = path.replace(/['"]/g, '');
                const normalizedPath = this._normalizePath(pathWithoutQuotes, pathsWithoutFileName);

                return `const ${variableName} = await __loader.loadComponent('${normalizedPath}');`;
            })
            .replace(/import .*;/g, '')
            .trim();

        console.log(transpiledCode)

        return this._transpileExports(transpiledCode);
    }

    _transpileExports(code) {
        const exportMatches = [...code.matchAll(/export [^\s]+ ([^\s(]+)/g)];

        if (exportMatches.length === 0) {
            return code;
        }

        const codeWithoutExports = code.replace(/export /g, '');
        const constants = exportMatches.map(exportMatch => exportMatch[1]);

        return codeWithoutExports + `\n` + `return {${constants.join(', ')}};`;
    }

    _wrapWithFunction(code) {
        return `async (__loader) => {\ntry {\n${code}\n} catch(e) {\n__loader.handleError(e);\n}\n}`;
    }

    async _fetchData(url) {
        const cache = this._cacheEnabled ? 'default' : 'no-store';
        const response = await fetch(url, { cache });

        return response.text();
    }

    _getPathArray(path) {
        return path.substring(1).split('/');
    }

    _getFileExtension(path) {
        const fileName = this._getPathArray(path).pop();

        return fileName.includes('.') ? fileName.split('.').pop() : '';
    }

    _normalizePath(path, currentPaths) {
        if (!path.includes('/')) {
            return path;
        }

        const paths = path.split('/');
        const changeDirCount = paths.filter(dir => dir === '..').length;
        const pathsWithoutChangeDirs = paths.filter(dir => dir !== '.' && dir !== '..');
        const newPaths = (changeDirCount > 0 ? currentPaths.slice(0, -changeDirCount) : currentPaths)
            .concat(pathsWithoutChangeDirs);

        return `./${newPaths.join('/')}`;
    }

    _upperCaseFirstLetter(name) {
        return name[0].toUpperCase() + name.slice(1);
    }
}

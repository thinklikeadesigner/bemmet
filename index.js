var bemNaming = require('bem-naming'),
    stringifyObj = require('stringify-object');

var expandBemjson = function(str, parentBlock, opts) {
    if (typeof parentBlock === 'object') {
        opts = parentBlock;
        parentBlock = null;
    }

    opts || (opts = {});

    var naming = bemNaming(opts.naming),
        tree = str.split('>').reverse();

    function isShortcut(item) {
        return (item[0] === naming.elemDelim[0]) || (item[0] === naming.modDelim[0]);
    }

    function getParent(idx) {
        var parent;

        while(idx < tree.length - 1) {
            idx++;
            parent = tree[idx].trim();

            // b1+b2>__e1
            parent = parent.substr(parent.lastIndexOf('+') + 1);

            if (!isShortcut(parent)) {
                return naming.parse(parent).block;
            }
        }
    }

    function expandEntities(content, item, idx) {
        // E.g. 'b1 + b1'
        if (item.indexOf('+') < 0) return expandEntity(content, item, idx);

        var result = [],
            items = item.split('+');

        items.forEach(function(item, index) {
            var isLast = index === items.length - 1;

            item = item.trim();
            result = result.concat(expandEntity(isLast ? content : {}, item, idx));
        });

        return result;
    }

    function expandEntity(content, item, idx) {
        // E.g. 'b1 * 2'
        var mult = /(.+)(?:\s)?\*(?:\s)?(\d)/.exec(item);
        if (mult) {
            var result = [],
                item = mult[1],
                times = +mult[2];

            for (var i = 0; i < times; i++) {
                result.push(expandEntity(content, item, idx));
            }

            return result;
        }

        var parent = getParent(idx);

        // expand mods and elems shotcuts by context (e.g. __e1 -> parent__e1)
        if (isShortcut(item)) {
            item = (parent || parentBlock || 'parentBlockStubPlaceholder') + item;
        }

        // E.g. 'b1{some content}'
        var contentChunks = /([\w\d-]+)(?:\s)?\{(?:\s)?(.*)(?:\s)?\}/.exec(item);
        if (contentChunks) {
            item = contentChunks[1];
            content = contentChunks[2];
        }

        var entity = naming.parse(item);
        if (!entity) return item;

        if (entity.modName) {
            entity.block === 'parentBlockStubPlaceholder' && (entity.block === 'parent');

            var modFieldName = entity.elem ? 'elemMods' : 'mods';

            entity[modFieldName] = {};
            entity[modFieldName][entity.modName] = entity.modVal;
            delete entity.modName;
            delete entity.modVal;
        }

        // remove block field if it matches its parent block name
        if (naming.isElem(entity) && entity.block === parent || entity.block === 'parentBlockStubPlaceholder') {
            delete entity.block;
        }

        entity.content = content;

        return entity;
    }

    return tree.reduce(function(content, item, idx) {
        item = item.trim();

        var parentheses = /\((.*)\)(?:\s)?\*(?:\s)?(\d)/.exec(item);
        if (parentheses) {
            var result = [];

            for (var i = 0, times = parentheses[2]; i < times; i++) {
                result = result.concat(expandEntities(content, parentheses[1], idx));
            }

            return result;
        }

        return expandEntities(content, item, idx);
    }, {});
}

expandBemjson.stringify = function(str, parentBlock, opts) {
    if (typeof parentBlock === 'object') {
        opts = parentBlock;
        parentBlock = null;
    }

    opts || (opts = {});
    opts.indent || (opts.indent = '    ');

    var bemjson = expandBemjson(str, parentBlock, opts);

    return typeof bemjson === 'string' ? bemjson : stringifyObj(bemjson, opts);
}

module.exports = expandBemjson;

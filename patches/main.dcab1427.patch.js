//=============================================================================
// main.js
//=============================================================================

const debounce = (fn, wait = 100) => {
  let timerId;

  return () => {
    clearTimeout(timerId);
    timerId = setTimeout(fn, wait);
  };
}

const debouncedSave = debounce(() => fetch('/mvix/save', {
  method: 'POST',
  body: JSON.stringify(localStorage)
}))

const proxiedSetItem = (key, value) => {
  debouncedSave();
  return Reflect.set(localStorageProxy, key, value)
}

const proxiedGetItem = (key) => {
  return Reflect.get(localStorageProxy, key)
}

const localStorageProxy = new Proxy(window.localStorage,{
  get: (ls, prop) => {
    if (prop === 'setItem') {
      return proxiedSetItem;
    } else if (prop === 'getItem') {
      return proxiedGetItem;
    } else if (prop === 'key') {
      return (key) => Reflect.apply(ls.key, ls, [key]);
    } else if (prop === 'clear') {
      return () => Reflect.apply(ls.clear, ls, []);
    } else if (prop === 'removeItem') {
      return (key) => Reflect.apply(ls.removeItem, ls, [key])
    }
    return Reflect.get(ls, prop)
  },
});

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  enumerable: true,
  value: localStorageProxy,
});

const loadRemoteGameSave = (remoteGameSave) => {
  localStorage.clear()
  for (const k of Object.keys(remoteGameSave)) {
    localStorage.setItem(k, remoteGameSave[k])
  }
}

PluginManager.setup($plugins);

window.onload = async () => {
  const remoteGameSave = await fetch('/mvix/load', {method: 'POST'}).then((res) => res.json())
  const currentGame = localStorage.getItem('mvix:current');

  if(remoteGameSave) {
    if(currentGame && currentGame !== document.title) {
      const shouldOverwrite = confirm(`The save data of "${remoteGameSave['mvix:current']}" will OVERWRITE the save data of "${currentGame}", continue?`);

      if(!shouldOverwrite) {
        return document.write('<h1>Please ensure that your previous game save file existed, then overwrite by new game.</h1>')
      }
    }

    loadRemoteGameSave(remoteGameSave)
  }

  localStorage.setItem('mvix:current', document.title);
  SceneManager.run(Scene_Boot);
};

try {
    const { store, switching, colors } = document.currentScript.dataset;
    const ramps = JSON.parse(colors);
    const id = localStorage.getItem(store);
    if (Object.hasOwn(ramps, id)) {
        document.documentElement.dataset.theme = id;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ramps[id]);
    }
    if (sessionStorage.getItem(switching) === '1') {
        document.documentElement.dataset.tubeSwitch = '1';
        sessionStorage.removeItem(switching);
    }
}
catch {
}

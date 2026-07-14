const normalizeZipName = (name) => name.replace(/ /g, '.');

const normalizeManifest = (manifest, normalizedZipName) => {
  const releases = (manifest.releases ?? []).map((release) => {
    if (release.version !== manifest.currentRelease) {
      return release;
    }
    if (!release.updateTo?.url) {
      return release;
    }

    const url = new URL(release.updateTo.url);
    const segments = url.pathname.split('/');
    segments[segments.length - 1] = normalizedZipName;
    url.pathname = segments.join('/');

    return {
      ...release,
      updateTo: {
        ...release.updateTo,
        url: url.toString(),
      },
    };
  });

  return { ...manifest, releases };
};

module.exports = { normalizeManifest, normalizeZipName };

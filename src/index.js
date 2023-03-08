export default {
  /** @param {Request} request */
  async fetch(request, env) {
    accessLog(request);

    let subdomain = new URL(request.url).hostname.split('.')[0];
    /** @type {function(Request):Response} */
    let camouflage = camo[subdomain];
    if (camouflage) {
      return camouflage(request);
    } else {
      return camo.archlinux(request);
    }
  },
};

const camo = {
  blender: async (request) => {
    return await proxyPass(new URL("https://git.blender.org"), request);
  },
  archlinux: async (request) => {
    return await proxyPass(new URL("https://geo.mirror.pkgbuild.com"), request);
  },
  archlinuxarm: async (request) => {
    return await proxyPass(new URL("https://ca.us.mirror.archlinuxarm.org"), request);
  },
  manjaro: async (request) => {
    return await proxyPass(new URL("http://manjaro.mirrors.uk2.net"), request, (content) => {
      return content.replaceAll("Port 80", "Port 443");
    });
  },
  alpine: async (request) => {
    return await proxyPass(new URL("https://dl-cdn.alpinelinux.org"), request);
  },
  ubuntu: async (request) => {
    return await proxyPass(new URL("http://archive.ubuntu.com"), request, (content) => {
      return content.replaceAll("Port 80", "Port 443");
    });
  },
  debian: async (request) => {
    return await proxyPass(new URL("http://archive.debian.org"), request, (content) => {
      return content.replaceAll("Port 80", "Port 443");
    });
  },
  fedora: async (request) => {
    return await proxyPass(new URL("https://archives.fedoraproject.org"), request);
  },
  centos: async (request) => {
    return await proxyPass(new URL("https://mirrors.edge.kernel.org/centos"), request, (content) => {
      return content.replaceAll("Index of /centos", "Index of ");
    });
  },
  opensuse: async (request) => {
    return await proxyPass(new URL("https://opensuse.mirror.iphh.net"), request);
  },
  freebsd: async (request) => {
    return await proxyPass(new URL("https://mirrors.mit.edu/FreeBSD"), request, (content) => {
      return content.replaceAll("Index of /FreeBSD", "Index of ");
    });
  },
  kde: async (request) => {
    return await proxyPass(new URL("https://mirrors.mit.edu/kde"), request, (content) => {
      return content.replaceAll("Index of /kde", "Index of ");
    });
  },
  gnome: async (request) => {
    return await proxyPass(
      new URL("https://cdimage.debian.org/mirror/gnome.org/sources/"), request, 
      (content) => {
        return content.replaceAll("Index of /mirror/gnome.org/sources", "Index of /").replaceAll("//", "/");
      },
      cdimage_debian_org_pathName
    );
  },
  msys2: async (request) => {
    return await proxyPass(new URL("https://cdimage.debian.org/mirror/msys2.org/"), request,
      (content) => {
        return content.replaceAll("Index of /mirror/msys2.org", "Index of /");
      },
      cdimage_debian_org_pathName
    )
  },
  netbsd: async (request) => {
    return await proxyPass(new URL("https://cdimage.debian.org/mirror/netbsd.org/NetBSD/"), request,
      (content) => {
        return content.replaceAll("Index of /mirror/netbsd.org/NetBSD", "Index of /");
      },
      cdimage_debian_org_pathName
    )
  },
  voidlinux: async (request) => {
    return await proxyPass(new URL("https://cdimage.debian.org/mirror/voidlinux/"), request,
      (content) => {
        return content.replaceAll("Index of /mirror/voidlinux", "Index of /");
      },
      cdimage_debian_org_pathName
    )
  },
}

/**
 * @param {URL} proxyURL
 * @param {Request} request
 * @param {function(string):string} modifyContentCallback
 * @param {function(string, string):string} pathnameCallback
 * @return {Response}
 */
async function proxyPass(proxyURL, request, modifyContentCallback = null, pathnameCallback = null) {
  const originURL = new URL(request.url);
  if (pathnameCallback) {
    proxyURL.pathname = pathnameCallback(proxyURL.pathname, originURL.pathname);
  } else {
    proxyURL.pathname += originURL.pathname;
    proxyURL.pathname = proxyURL.pathname.replaceAll("//", "/");
  }
  proxyURL.search = originURL.search;
  
  let rsp = await fetch(proxyURL, request, {cf: {cacheEverything: true}});  
  rsp = new Response(rsp.body, rsp);
  
  // replace hostname in content
  if (rsp.headers.get("Content-Type").includes("text")) {
    let content = await rsp.text();
    content = content.replaceAll(proxyURL.hostname, originURL.hostname);
    content = content.replaceAll(proxyURL.protocol, originURL.protocol);  
    if (modifyContentCallback) {
      content = modifyContentCallback(content);
    }    
    rsp = new Response(content, rsp);
  }
  // replace hostname in headers  
  rsp.headers.forEach((value, key) => {
    value = value.replaceAll(proxyURL.hostname, originURL.hostname);
    value = value.replaceAll(proxyURL.protocol, originURL.protocol);
    rsp.headers.set(key, value);
  })

  return rsp
}

/**
 * @param {Request} request
 */
function accessLog(request) {
  try {
    let cf = request.cf
    console.log({
      ip: request.headers.get("cf-connecting-ip"),
      country: cf.country,
      loc: `${cf.longitude}, ${cf.latitude}`,
      userAgent: request.headers.get("user-agent"),
      colo: cf.colo,
      asn: cf.asn,      
      asOrganization: cf.asOrganization,
      timezone: cf.timezone,      
      tlsVersion: cf.tlsVersion,
      httpProtocol: cf.httpProtocol
    });
  } catch(error) {
    console.log("[logging error] " + error)
  }
}

function cdimage_debian_org_pathName(proxy, origin) {
  let p1 = origin.split("/")[1];
  if (p1 === "icons2" || p1 === "layout") {
    return origin;
  } else {
    return proxy + origin;
  }
}

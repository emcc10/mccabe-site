const pages = [
  'https://www.pexels.com/video/brown-leather-couch-in-living-room-6950832/',
  'https://www.pexels.com/video/soft-blanket-on-sofa-4057256/',
  'https://www.pexels.com/video/people-having-dinner-3209828/',
  'https://www.pexels.com/video/living-room-interior-design-7574202/',
];

for (const page of pages) {
  const res = await fetch(page, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const html = await res.text();
  const urls = [...html.matchAll(/https:\/\/videos\.pexels\.com\/video-files\/[^"\\]+/g)].map((m) =>
    m[0].replace(/\\u0026/g, '&'),
  );
  console.log('\n', page, res.status);
  console.log([...new Set(urls)].slice(0, 4).join('\n'));
}

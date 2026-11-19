{
  const sources = [
    "assets/photo-1-76bf3cc3-e76.jpg",
    "assets/photo-2-981abd8e-4bc.jpg",
    "assets/photo-3-646b767f-e4b.jpg",
    "assets/photo-4-6d746df4-f8f.jpg",
    "assets/photo-5-65441757-272.jpg",
    "assets/photo-6-d443126f-c03.jpg",
    "assets/photo-7-89ae8614-844.jpg",
    "assets/photo-8-33f08221-e8b.jpg",
    "assets/photo-9-c96371a6-850.jpg",
    "assets/photo-10-ca0ecff8-558.jpg",
    "assets/photo-11-1b2ef787-c3f.jpg",
    "assets/photo-12-f7dde969-36c.jpg"
  ];
  GIFT.photos.forEach((photo, index) => {
    if (sources[index]) photo.src = sources[index];
  });
}

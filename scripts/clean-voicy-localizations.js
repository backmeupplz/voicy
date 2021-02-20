db.getCollection('localizations').find({tags:'voicybot'}).forEach(l => {
    const needsFixing = !!l.variants.find(v => !v.selected)
    if (needsFixing) {
        l.variants = l.variants.filter(v => v.selected)
        db.localizations.save(l)
    }
})
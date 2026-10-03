package factory

import (
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/collector"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/collector/header"
)

// Registrations - composition root: единственное место, где перечислны
// все коллекторы сервиса. Чтобы добавить новый коллектор:
// 1. реализовать collector.Collector в своем пакете
// 2. добаить сюда Registration с Factory, строящей этот коллектор
// 3. если колектор активный (брутфорс, DNS-зонный трансфер и т.п.) -
// поставить Kind: collector.KindActive, иначе остается KindPassive
var Registrations = []Registration{
	{
		Name:    "header",
		Kind:    KindPassive,
		Factory: func() collector.Collector { return header.NewHeaderCollector() },
	},
}

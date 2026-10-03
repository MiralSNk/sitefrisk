package factory

import "github.com/MiralSNk/sitefrisk/services/scanner/internal/collector"

// Factory -> строит готовый к работе Collector
type Factory func() collector.Collector

// Kind -> разделяет коллекторы по риску для цели
type Kind string

// Valid сообщает, известно ли k.
// Новый Kind - обнови этот switch пж
// (или поставьте exhaustive-линтер на него)
func (k Kind) Valid() bool {
	switch k {
	case KindPassive, KindActive:
		return true
	default:
		return false
	}
}

const (
	// KindPassive -> обычный GET/HEAD, не агрессивно
	KindPassive Kind = "passive"
	// KindActive -> брутформ путей, DNS-зонные трансферы и т.п.
	KindActive Kind = "active"
)

// Registration - фабрика Collector для регистрации
// в composition root (main.go)
//
// Чтобы добавить новый Collector в сервис:
// Реализовать Collector в своем пакете (internal/collector/header)
// Registration в main.go менять не нужно
type Registration struct {
	Name    string
	Kind    Kind
	Factory Factory
}

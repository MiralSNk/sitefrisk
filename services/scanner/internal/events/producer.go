package events

import (
	"context"
	"encoding/json"
	"time"

	"github.com/segmentio/kafka-go"
)

type Fact struct {
	ScanID     string `json:"scan_id"`
	Type       string `json:"type"`
	Target     string `json:"target"`
	Serverity  string `json:"serverity"`
	DetectedAt string `json:"detected_at"`
}

type Producer struct {
	writer *kafka.Writer
}

func New(brockers []string, topic string) *Producer {
	return &Producer{
		writer: &kafka.Writer{
			Addr:  kafka.TCP(brockers...),
			Topic: topic,

			// Определяет в какую Partiotions уйдет сообщение
			Balancer: &kafka.Murmur2Balancer{},

			// Гарантия, что все сообщения будут доставлены
			RequiredAcks: kafka.RequireAll,
			Compression:  kafka.Zstd,

			// Ограничение на пулл сообщения и таймаута
			BatchSize:    100,                   // 100 сообщений
			BatchTimeout: 10 * time.Millisecond, // 10мс

			MaxAttempts: 10,
			// Сообщения блокируются до принятия
			Async: false,
		},
	}
}

func (p *Producer) PublishFact(ctx context.Context, f Fact) error {
	payload, err := json.Marshal(f)
	if err != nil {
		return err
	}

	return p.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(f.ScanID),
		Value: payload,
		Headers: []kafka.Header{
			{Key: "event-type", Value: []byte("fact.collected")},
			{Key: "schema-version", Value: []byte("1")},
		},
		Time: time.Now(),
	})
}

func (p *Producer) PublishBatch(ctx context.Context, facts []Fact) error {
	msgs := make([]kafka.Message, 0, len(facts))
	for _, f := range facts {
		payload, err := json.Marshal(f)
		if err != nil {
			return err
		}

		msgs = append(msgs, kafka.Message{
			Key:   []byte(f.ScanID),
			Value: payload,
		})
	}

	return p.writer.WriteMessages(ctx, msgs...)
}

func (p *Producer) Close() error {
	return p.writer.Close()
}

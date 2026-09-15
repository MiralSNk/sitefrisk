package collector_test

import (
	"context"
	"errors"
	"testing"
	"time"

	scanner "github.com/MiralSNk/sitefrisk/services/scanner/internal/collector"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/fact"
	"github.com/MiralSNk/sitefrisk/services/scanner/internal/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestScanner(t *testing.T) {
	url := "http://example.com"

	cases := []struct {
		name              string
		ctx               func(t *testing.T) context.Context
		exColl            func(t *testing.T) []scanner.Collector
		url               string
		wantCollectorErrs []error
		wantFinalErr      error
		wantFinalFactsLen int
	}{
		{
			name: "Успех: два коллектора вернули факты",
			ctx:  func(t *testing.T) context.Context { return context.Background() },
			exColl: func(t *testing.T) []scanner.Collector {
				c1 := mocks.NewMockCollector(t)
				c1.EXPECT().
					Collect(mock.Anything, url).
					Return([]fact.Fact{{Category: fact.CategoryHeader, Key: "k1", Value: "v1"}}, nil).
					Once()

				c2 := mocks.NewMockCollector(t)
				c2.EXPECT().
					Collect(mock.Anything, url).
					Return([]fact.Fact{{Category: fact.CategoryTls, Key: "k2", Value: "v2"}}, nil).
					Once()

				return []scanner.Collector{c1, c2}
			},
			url:               url,
			wantFinalFactsLen: 2,
		},
		{
			name:              "Успех: пустой список коллекторов",
			ctx:               func(t *testing.T) context.Context { return context.Background() },
			exColl:            func(t *testing.T) []scanner.Collector { return nil },
			url:               url,
			wantFinalFactsLen: 0,
		},
		{
			name: "Успех: коллекторы вернули пустоту",
			ctx:  func(t *testing.T) context.Context { return context.Background() },
			exColl: func(t *testing.T) []scanner.Collector {
				c1 := mocks.NewMockCollector(t)
				c1.EXPECT().Collect(mock.Anything, url).Return(nil, nil).Once()

				c2 := mocks.NewMockCollector(t)
				c2.EXPECT().Collect(mock.Anything, url).Return(nil, nil).Once()

				return []scanner.Collector{c1, c2}
			},
			url:               url,
			wantFinalFactsLen: 0,
		},
		{
			name: "Ошибка: первый коллектор упал",
			ctx:  func(t *testing.T) context.Context { return context.Background() },
			exColl: func(t *testing.T) []scanner.Collector {
				c1 := mocks.NewMockCollector(t)
				c1.EXPECT().
					Collect(mock.Anything, url).
					Return(nil, fact.ErrValidationKey).
					Once()

				c2 := mocks.NewMockCollector(t)
				c2.EXPECT().
					Collect(mock.Anything, url).
					Return([]fact.Fact{{Category: fact.CategoryHeader, Key: "k", Value: "v"}}, nil).
					Once()

				return []scanner.Collector{c1, c2}
			},
			url:               url,
			wantCollectorErrs: []error{fact.ErrValidationKey},
			wantFinalErr:      fact.ErrValidationKey,
			wantFinalFactsLen: 1,
		},
		{
			name: "Ошибка: второй коллектор упал",
			ctx:  func(t *testing.T) context.Context { return context.Background() },
			exColl: func(t *testing.T) []scanner.Collector {
				c1 := mocks.NewMockCollector(t)
				c1.EXPECT().
					Collect(mock.Anything, url).
					Return([]fact.Fact{{Category: fact.CategoryHeader, Key: "k", Value: "v"}}, nil).
					Once()

				c2 := mocks.NewMockCollector(t)
				c2.EXPECT().
					Collect(mock.Anything, url).
					Return(nil, fact.ErrValidationCategory).
					Once()

				return []scanner.Collector{c1, c2}
			},
			url:               url,
			wantCollectorErrs: []error{fact.ErrValidationCategory},
			wantFinalErr:      fact.ErrValidationCategory,
			wantFinalFactsLen: 1,
		},
		{
			name: "Таймаут: медленный коллектор",
			ctx: func(t *testing.T) context.Context {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
				t.Cleanup(cancel)
				return ctx
			},
			exColl: func(t *testing.T) []scanner.Collector {
				c1 := mocks.NewMockCollector(t)
				c1.EXPECT().
					Collect(mock.Anything, url).
					Run(func(ctx context.Context, _ string) {
						select {
						case <-time.After(500 * time.Millisecond):
						case <-ctx.Done():
						}
					}).
					Return(nil, context.DeadlineExceeded).
					Maybe()

				return []scanner.Collector{c1}
			},
			url:               url,
			wantCollectorErrs: nil, // см. примечание про флаки — допускаем и 0, и 1
			wantFinalErr:      context.DeadlineExceeded,
			wantFinalFactsLen: 0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			colls := tc.exColl(t)
			ch := scanner.RunAll(tc.ctx(t), colls, tc.url)

			var (
				gotCollectorErrs []error
				finalEvent       *scanner.Event
			)

			for event := range ch {
				switch event.Type {
				case scanner.EventCollectorDone:
					if event.Err != nil {
						gotCollectorErrs = append(gotCollectorErrs, event.Err)
					}
				case scanner.EventValidationDone:
					e := event
					finalEvent = &e
				}
			}

			require.NotNil(t, finalEvent, "должно прийти EventValidationDone")
			assert.Len(t, finalEvent.Validated.Facts(), tc.wantFinalFactsLen)

			if tc.wantFinalErr == nil {
				assert.NoError(t, finalEvent.Err)
			} else {
				require.Error(t, finalEvent.Err)
				assert.ErrorIs(t, finalEvent.Err, tc.wantFinalErr)
			}

			if len(tc.wantCollectorErrs) == 0 {
				assert.Empty(t, gotCollectorErrs)
			} else {
				require.Len(t, gotCollectorErrs, len(tc.wantCollectorErrs))
				for _, wantErr := range tc.wantCollectorErrs {
					found := false
					for _, gotErr := range gotCollectorErrs {
						if errors.Is(gotErr, wantErr) {
							found = true
							break
						}
					}
					assert.True(t, found, "ожидалась ошибка %v", wantErr)
				}
			}
		})
	}
}

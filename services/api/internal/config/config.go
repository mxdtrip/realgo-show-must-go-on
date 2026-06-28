package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Env         string `yaml:"env" env-default:"local"`
	HTTPServer  `yaml:"http_server"`
	Database    `yaml:"database"`
	Redis       `yaml:"redis"`
}

type HTTPServer struct {
	Address     string        `yaml:"address" env:"ADDRESS" env-default:"localhost:8080"`
	Timeout     time.Duration `yaml:"timeout" env-default:"4s"`
	IdleTimeout time.Duration `yaml:"idle_timeout" env-default:"30s"`
}

type Database struct {
	Host            string        `yaml:"host" env:"DB_HOST" env-default:"localhost"`
	Port            int           `yaml:"port" env:"DB_PORT" env-default:"5432"`
	User            string        `yaml:"user" env:"DB_USER" env-default:"postgres"`
	Password        string        `yaml:"password" env:"DB_PASSWORD" env-default:""`
	DBName          string        `yaml:"dbname" env:"DB_NAME" env-default:"freeburger"`
	SSLMode         string        `yaml:"sslmode" env:"DB_SSLMODE" env-default:"disable"`
	MaxConns        int32         `yaml:"max_conns" env:"DB_MAX_CONNS" env-default:"10"`
	MinConns        int32         `yaml:"min_conns" env:"DB_MIN_CONNS" env-default:"2"`
	MaxConnLifetime time.Duration `yaml:"max_conn_lifetime" env:"DB_MAX_CONN_LIFETIME" env-default:"1h"`
	MaxConnIdleTime time.Duration `yaml:"max_conn_idle_time" env:"DB_MAX_CONN_IDLE_TIME" env-default:"30m"`
}

type Redis struct {
	Host     string `yaml:"host" env:"REDIS_HOST" env-default:"localhost"`
	Port     string `yaml:"port" env:"REDIS_PORT" env-default:"6379"`
	Password string `yaml:"password" env:"REDIS_PASSWORD"`
	DB       int    `yaml:"db" env:"REDIS_DB" env-default:"0"`
}

func Load() (*Config, error) {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		return nil, fmt.Errorf("CONFIG_PATH is not set")
	}

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config file does not exist: %s", configPath)
	}

	var cfg Config
	if err := cleanenv.ReadConfig(configPath, &cfg); err != nil {
		return nil, fmt.Errorf("cannot read config: %w", err)
	}

	return &cfg, nil
}

func (d *Database) ConnString() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode)
}

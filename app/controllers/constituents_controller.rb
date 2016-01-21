class ConstituentsController < ApplicationController

  respond_to :html, :json

  def show
    connection_string = "https://#{ENV['ELASTIC_USER']}:#{ENV['ELASTIC_PASSWORD']}@#{ENV['ELASTIC_HOST']}"
    client = Elasticsearch::Client.new host: connection_string
    begin
      @constituent = client.search index: 'pic', q: "constituent.ConstituentID:#{params[:id]}"
    rescue
      @constituent = nil
    end
    respond_with @constituent do |f|
      f.html
      f.json
    end
  end

end
